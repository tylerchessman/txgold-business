import { TxGoldApiError } from './errors.js';
import { loadKeyFile, type SigningKey } from './keys.js';
import { TimestampClock, canonicalString, signCanonical } from './signing.js';
import type {
  Account, AccountLookup, AccountTransaction, Page, Payment, PaymentCreate, PaymentRequest,
  PaymentRequestCreate, PaymentRequestStatus, Rate, RefundCreate, RequestOptions, SandboxPayRequest,
} from './types.js';

export const VERSION = '0.2.0';

/** The API's base URL per environment. */
export const BASE_URLS: Record<string, string> = {
  sandbox: 'https://api-sandbox.txgold.money',
  production: 'https://api.txgold.money',
};

export interface TxGoldClientOptions {
  /** A key file path, or a key from {@link loadKeyFile} / {@link signingKey}. */
  key: string | SigningKey;
  /** "sandbox" or "production". Default: the key file's environment, else "sandbox". */
  environment?: string;
  /** Overrides the environment's URL (a local host, for example). */
  baseUrl?: string;
  /**
   * Retries after a network error or a 502/503/504, re-sending the identical signed request (same
   * timestamp), so a payment is never made twice. Default 0.
   */
  maxRetries?: number;
  /** Per-attempt timeout. Default 30 seconds. */
  timeoutMs?: number;
  /** For tests, or a fetch with a proxy. Default: the global fetch. */
  fetch?: typeof fetch;
}

type Query = Record<string, string | number | undefined>;

/** The TxGold Business API. Every request is signed with the key it was made with. */
export class TxGoldClient {
  readonly baseUrl: string;
  readonly keyId: string;
  readonly payments: Payments;
  readonly paymentRequests: PaymentRequests;
  readonly accounts: Accounts;
  readonly rates: Rates;
  readonly sandbox: Sandbox;

  private readonly key: SigningKey;
  private readonly clock = new TimestampClock();
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TxGoldClientOptions) {
    this.key = typeof options.key === 'string' ? loadKeyFile(options.key) : options.key;
    const environment = options.environment ?? this.key.environment ?? 'sandbox';
    const base = options.baseUrl ?? BASE_URLS[environment];
    if (!base)
      throw new Error(`No base URL is known for the "${environment}" environment yet; pass baseUrl.`);
    this.baseUrl = base.replace(/\/+$/, '');
    this.keyId = this.key.keyId;
    this.maxRetries = options.maxRetries ?? 0;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetch ?? globalThis.fetch;

    this.payments = new Payments(this);
    this.paymentRequests = new PaymentRequests(this);
    this.accounts = new Accounts(this);
    this.rates = new Rates(this);
    this.sandbox = new Sandbox(this);
  }

  /** Sends one signed request and returns the parsed JSON body. Throws {@link TxGoldApiError}. */
  async request<T>(method: string, path: string, query?: Query, body?: unknown, options: RequestOptions = {}): Promise<T> {
    const queryString = toQueryString(query);
    // The signature covers these exact bytes, and they are what is sent
    const bytes = body === undefined ? new Uint8Array(0) : new TextEncoder().encode(JSON.stringify(body));
    const timestamp = options.timestamp ?? this.clock.next();
    const signature = signCanonical(this.key.privateKey, canonicalString(method, path, queryString, timestamp, bytes));
    const url = `${this.baseUrl}${path}${queryString ? `?${queryString}` : ''}`;
    const headers: Record<string, string> = {
      'TxG-Key-Id': this.key.keyId,
      'TxG-Timestamp': timestamp,
      'TxG-Signature': signature,
      Accept: 'application/json',
      'User-Agent': `txgold-business-js/${VERSION}`,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method,
          headers,
          body: body === undefined ? undefined : bytes,
          signal: options.signal ?? AbortSignal.timeout(this.timeoutMs),
        });
      } catch (error) {
        if (attempt < this.maxRetries && !options.signal?.aborted) {
          await delay(attempt);
          continue;
        }
        throw error;
      }
      if ([502, 503, 504].includes(response.status) && attempt < this.maxRetries) {
        await delay(attempt);
        continue;
      }
      const text = await response.text();
      const parsed = text ? (JSON.parse(text) as unknown) : undefined;
      if (!response.ok)
        throw new TxGoldApiError(response.status, (parsed ?? {}) as Record<string, unknown>);
      return parsed as T;
    }
  }

  /** Walks every page of a list call. */
  async *paginate<T>(list: (cursor?: string) => Promise<Page<T>>): AsyncGenerator<T> {
    let cursor: string | undefined;
    do {
      const page = await list(cursor);
      yield* page.data;
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  }
}

function toQueryString(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query))
    if (value !== undefined && value !== '') params.append(name, String(value));
  return params.toString();
}

function delay(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.min(500 * 2 ** attempt, 8_000)));
}

const id = (value: string) => encodeURIComponent(value);

export class Payments {
  constructor(private readonly client: TxGoldClient) {}

  /** Sends a payment (201), or returns the original one (200) for a resend with the same timestamp. */
  create(payment: PaymentCreate, options?: RequestOptions): Promise<Payment> {
    return this.client.request('POST', '/v1/payments', undefined, payment, options);
  }

  /** One payment, seen from `accountId` (the payer or the payee). */
  get(paymentId: string, accountId: string, options?: RequestOptions): Promise<Payment> {
    return this.client.request('GET', `/v1/payments/${id(paymentId)}`, { accountId }, undefined, options);
  }

  /** Refunds a payment your account received, in whole or in part. */
  refund(paymentId: string, refund: RefundCreate = {}, options?: RequestOptions): Promise<Payment> {
    return this.client.request('POST', `/v1/payments/${id(paymentId)}/refunds`, undefined, refund, options);
  }
}

export interface PaymentRequestListOptions {
  status?: PaymentRequestStatus;
  /** 1-200, default 50. */
  limit?: number;
  cursor?: string;
}

export class PaymentRequests {
  constructor(private readonly client: TxGoldClient) {}

  /**
   * Asks for a payment: from payerAccountId, from payerHandle, or (with neither) an open request
   * that anyone with its paymentUrl can pay once. Giving both is a 400 invalid_request.
   */
  create(request: PaymentRequestCreate, options?: RequestOptions): Promise<PaymentRequest> {
    return this.client.request('POST', '/v1/payment-requests', undefined, request, options);
  }

  get(requestId: string, options?: RequestOptions): Promise<PaymentRequest> {
    return this.client.request('GET', `/v1/payment-requests/${id(requestId)}`, undefined, undefined, options);
  }

  list(accountId: string, list: PaymentRequestListOptions = {}, options?: RequestOptions): Promise<Page<PaymentRequest>> {
    return this.client.request('GET', '/v1/payment-requests', { accountId, ...list }, undefined, options);
  }

  /** Every request, across pages. */
  listAll(accountId: string, list: Omit<PaymentRequestListOptions, 'cursor'> = {}): AsyncGenerator<PaymentRequest> {
    return this.client.paginate((cursor) => this.list(accountId, { ...list, cursor }));
  }

  cancel(requestId: string, options?: RequestOptions): Promise<PaymentRequest> {
    return this.client.request('POST', `/v1/payment-requests/${id(requestId)}/cancel`, undefined, undefined, options);
  }
}

export interface TransactionListOptions {
  /** Earliest time, inclusive: ISO 8601, or a date (midnight UTC). */
  from?: string;
  /** Latest time, exclusive. */
  to?: string;
  /** 1-200, default 50. */
  limit?: number;
  cursor?: string;
}

export class Accounts {
  constructor(private readonly client: TxGoldClient) {}

  get(accountId: string, options?: RequestOptions): Promise<Account> {
    return this.client.request('GET', `/v1/accounts/${id(accountId)}`, undefined, undefined, options);
  }

  transactions(accountId: string, list: TransactionListOptions = {}, options?: RequestOptions): Promise<Page<AccountTransaction>> {
    return this.client.request('GET', `/v1/accounts/${id(accountId)}/transactions`, { ...list }, undefined, options);
  }

  /** Every transaction in the range, across pages. */
  transactionsAll(accountId: string, list: Omit<TransactionListOptions, 'cursor'> = {}): AsyncGenerator<AccountTransaction> {
    return this.client.paginate((cursor) => this.transactions(accountId, { ...list, cursor }));
  }

  /** A business or charity by its handle, with or without the @. */
  lookup(accountName: string, options?: RequestOptions): Promise<AccountLookup> {
    return this.client.request('GET', '/v1/accounts/lookup', { accountName }, undefined, options);
  }
}

export class Rates {
  constructor(private readonly client: TxGoldClient) {}

  /** The current TxGold rate. */
  get(options?: RequestOptions): Promise<Rate> {
    return this.client.request('GET', '/v1/rates', undefined, undefined, options);
  }
}

/** Sandbox-only helpers. They return 404 in production. */
export class Sandbox {
  constructor(private readonly client: TxGoldClient) {}

  /** Adds test TxGold to one of your accounts, or one of its demo customers. */
  fund(accountId: string, amount: string, options?: RequestOptions): Promise<Payment> {
    return this.client.request('POST', `/v1/sandbox/accounts/${id(accountId)}/fund`, undefined, { amount }, options);
  }

  /**
   * Has the demo customer a pending request was sent to pay it, as they would in the app. For an
   * open request, `pay.payerAccountId` picks which demo customer pays (default: the first one).
   * A body is sent (and signed) only when payerAccountId is given.
   */
  payRequest(requestId: string, options?: RequestOptions): Promise<Payment>;
  payRequest(requestId: string, pay: SandboxPayRequest, options?: RequestOptions): Promise<Payment>;
  payRequest(requestId: string, payOrOptions?: SandboxPayRequest | RequestOptions, options?: RequestOptions): Promise<Payment> {
    // 0.1 took (requestId, options): accept that shape still
    let pay: SandboxPayRequest = {};
    if (options === undefined && payOrOptions && isRequestOptions(payOrOptions)) options = payOrOptions;
    else pay = (payOrOptions ?? {}) as SandboxPayRequest;
    const body = pay.payerAccountId ? { payerAccountId: pay.payerAccountId } : undefined;
    return this.client.request('POST', `/v1/sandbox/payment-requests/${id(requestId)}/pay`, undefined, body, options);
  }
}

function isRequestOptions(value: object): value is RequestOptions {
  return !('payerAccountId' in value) && ('timestamp' in value || 'signal' in value);
}
