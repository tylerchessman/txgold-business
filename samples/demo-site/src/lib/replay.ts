// The recorded run (decision D42): when the Sandbox doesn't answer, the page plays the demo API's
// part itself, from responses recorded in a real run (src/recorded/run.json, made by
// scripts/record.mjs). It keeps the requests of this page in memory and answers each call with
// the recorded response for that call, its exchanges included, with this run's ids, amounts,
// memos, payers and times filled in. Every exchange it returns is marked `recorded`.
import type { DemoConfig, DemoMethod, Exchange, Payment, PaymentRequest, Result, Transaction } from './api';

type Json = Record<string, unknown>;

interface Response {
  exchanges: Exchange[];
  [key: string]: unknown;
}

export interface Recording {
  recordedAt: string;
  config: DemoConfig & { methods?: Record<string, { minutes: number }> };
  customerAccounts: string[];
  responses: {
    create: Record<DemoMethod, Response & { request: Json }>;
    get: Response;
    pay: { directed: Response; open: Response };
    cancel: Response;
    transactions: Response & { transactions: Transaction[] };
  };
}

const MINUTES: Record<DemoMethod, number> = { 'app-request': 15, 'web-checkout': 15, 'in-app': 10, till: 15, invoice: 15 };

export interface CreateBody {
  method: DemoMethod;
  amount: string;
  memo?: string;
  customer?: number;
  handle?: string;
}

export class Replay {
  private readonly requests = new Map<string, Json>();
  private nextRequest: number;
  private nextPayment: number;

  constructor(private readonly run: Recording, private readonly now: () => number = Date.now) {
    // Ids that follow the recorded ones, so they look like the API's own
    const ids = Object.values(run.responses.create).map((r) => Number(r.request.id) || 0);
    this.nextRequest = Math.max(0, ...ids) + 1;
    this.nextPayment = (Number((run.responses.pay.open.payment as Json).id) || 0) + 1;
  }

  get recordedAt() {
    return this.run.recordedAt;
  }

  config(): DemoConfig {
    return this.run.config;
  }

  /** A request this page created while the Sandbox still answered: carry on with it here. */
  adopt(request: PaymentRequest) {
    if (!this.requests.has(request.id)) this.requests.set(request.id, { ...request });
  }

  createRequest(body: CreateBody): Result<{ request: PaymentRequest }> {
    const recorded = this.run.responses.create[body.method];
    if (!recorded) return failure(400, { code: 'invalid_request', title: 'Some fields are not valid.' });
    const { customers } = this.run.config;

    let payerAccountId: string | null = null;
    let payerHandle: string | undefined;
    if (body.method === 'app-request') {
      payerAccountId = this.run.customerAccounts[body.customer ?? -1] ?? null;
      if (!payerAccountId) return failure(400, { code: 'invalid_request', title: 'Some fields are not valid.' });
    } else if (body.method === 'web-checkout') {
      const typed = (body.handle ?? '').trim().replace(/^@/, '').toLowerCase();
      const customer = customers.find((c) => c.handle.toLowerCase() === typed);
      if (!customer)
        return failure(422, {
          code: 'not_a_demo_customer',
          title: 'Not one of the demo customers',
          detail: `The demo can only ask its own customers to pay: ${customers.map((c) => '@' + c.handle).join(', ')}.`,
        });
      payerAccountId = this.run.customerAccounts[customer.index] ?? null;
      payerHandle = customer.handle;
    }

    const at = this.now();
    const amount = Number(body.amount).toFixed(2);
    const memo = body.memo?.trim() || null;
    const request: Json = {
      ...recorded.request,
      id: String(this.nextRequest++),
      status: 'pending',
      payerAccountId,
      amount,
      memo,
      createdAt: iso(at),
      expiresAt: iso(at + MINUTES[body.method] * 60_000),
      statusChangedAt: null,
      paymentId: null,
      paymentUrl: withAmount(recorded.request.paymentUrl, amount, memo),
    };
    this.requests.set(request.id as string, request);

    return this.answer(201, recorded, request, (sent) => {
      sent.amount = amount;
      if ('memo' in sent || memo) sent.memo = memo ?? undefined;
      sent.expiresAt = request.expiresAt;
      if ('payerAccountId' in sent) sent.payerAccountId = payerAccountId;
      if ('payerHandle' in sent) sent.payerHandle = payerHandle;
    });
  }

  getRequest(id: string): Result<{ request: PaymentRequest }> {
    const request = this.requests.get(id);
    if (!request) return notHere();
    return this.answer(200, this.run.responses.get, request);
  }

  pay(id: string, customer?: number): Result<{ request: PaymentRequest; payment: Payment }> {
    const request = this.requests.get(id);
    if (!request) return notHere();
    if (request.status !== 'pending')
      return failure(409, { code: 'request_not_pending', title: `The request is ${request.status}.` });
    const open = request.isOpen === true;
    const recorded = open ? this.run.responses.pay.open : this.run.responses.pay.directed;
    const payer = open ? this.run.customerAccounts[customer ?? 0] : (request.payerAccountId as string | null);
    if (!payer) return failure(400, { code: 'invalid_request', title: 'Some fields are not valid.' });

    const at = iso(this.now());
    const payment: Json = {
      ...(recorded.payment as Json),
      id: String(this.nextPayment++),
      accountId: payer,
      amount: request.amount,
      memo: request.memo,
      createdAt: at,
      paymentRequestId: request.id,
    };
    Object.assign(request, { status: 'paid', payerAccountId: payer, paymentId: payment.id, statusChangedAt: at });

    return this.answer(200, recorded, request, (sent) => {
      if ('payerAccountId' in sent) sent.payerAccountId = payer;
    }, payment);
  }

  cancel(id: string): Result<{ request: PaymentRequest }> {
    const request = this.requests.get(id);
    if (!request) return notHere();
    // Paid in the meantime: that wins, as on the server
    if (request.status !== 'pending') return this.answer(200, this.run.responses.get, request);
    Object.assign(request, { status: 'cancelled', statusChangedAt: iso(this.now()) });
    return this.answer(200, this.run.responses.cancel, request);
  }

  transactions(): Result<{ transactions: Transaction[] }> {
    const recorded = this.run.responses.transactions;
    return { ok: true, status: 200, transactions: clone(recorded.transactions), exchanges: mark(clone(recorded.exchanges)) };
  }

  /**
   * The recorded response, with this run's request (and payment) in place of the recorded ones:
   * in the body, in every exchange's response, and in the paths. `sent` patches what the
   * recorded call sent.
   */
  private answer<T>(status: number, recorded: Response, request: Json, sent?: (body: Json) => void, payment?: Json): Result<T> {
    const out = clone(recorded) as Response;
    const fill = (value: unknown) =>
      walk(value, (o) => {
        if ('isOpen' in o && 'status' in o) replaceWith(o, request);
        else if (payment && 'paymentRequestId' in o) replaceWith(o, payment);
      });
    fill(out);
    for (const exchange of out.exchanges) {
      exchange.path = exchange.path.replace(/\/payment-requests\/[^/?]+/, `/payment-requests/${request.id}`);
      if (sent && exchange.requestBody && typeof exchange.requestBody === 'object') sent(exchange.requestBody as Json);
    }
    out.exchanges = mark(out.exchanges);
    const { exchanges, ...body } = out;
    return { ok: true, status, exchanges, ...(body as T) } as Result<T>;
  }
}

/** The recorded run's payment link, with this request's amount and memo. */
function withAmount(url: unknown, amount: string, memo: string | null): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    u.searchParams.set('Amt', amount);
    if (memo) u.searchParams.set('Memo', memo);
    else u.searchParams.delete('Memo');
    return u.toString();
  } catch {
    return url;
  }
}

/** Keeps the object's own keys (the API's shape) and takes their values from `from`. */
function replaceWith(o: Json, from: Json) {
  for (const key of Object.keys(o)) if (key in from) o[key] = from[key];
}

function walk(value: unknown, visit: (o: Json) => void) {
  if (Array.isArray(value)) value.forEach((v) => walk(v, visit));
  else if (value && typeof value === 'object') {
    visit(value as Json);
    for (const v of Object.values(value)) walk(v, visit);
  }
}

const mark = (exchanges: Exchange[]) => exchanges.map((e) => ({ ...e, recorded: true }));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const iso = (ms: number) => new Date(ms).toISOString();

function failure(status: number, error: { code: string; title: string; detail?: string }) {
  return { ok: false as const, status, error, exchanges: [] };
}

const notHere = () =>
  failure(404, {
    code: 'not_found',
    title: "This request isn't in the recorded run.",
    detail: "The Sandbox isn't answering, so a phone can't pay it from another device. Use the phone on the demo page.",
  });
