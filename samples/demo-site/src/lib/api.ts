// The page's calls to its own /api (the Function that holds the Sandbox key). Every response
// carries `exchanges`: the Business API calls it made, for the "What just happened" panel.

export interface Exchange {
  method: string;
  path: string;
  origin: string;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  status: number;
  responseBody: unknown;
  ms: number;
}

export type RequestStatus = 'pending' | 'paid' | 'dismissed' | 'cancelled' | 'expired';

export interface PaymentRequest {
  id: string;
  status: RequestStatus;
  accountId: string;
  payerAccountId: string | null;
  isOpen: boolean;
  amount: string;
  memo: string | null;
  createdAt: string;
  expiresAt: string;
  paymentId: string | null;
  tag: string | null;
  paymentUrl: string | null;
}

export interface Payment {
  id: string;
  amount: string;
  direction: 'debit' | 'credit';
  createdAt: string;
}

export interface Transaction {
  id: string;
  direction: 'debit' | 'credit';
  amount: string;
  counterparty: { accountName: string | null; displayName: string | null } | null;
  memo: string | null;
  createdAt: string;
}

export interface DemoConfig {
  business: { accountId: string; accountName: string | null; displayName: string | null };
  customers: { index: number; handle: string }[];
  maxAmount: string;
}

export interface ApiError {
  code: string;
  title: string;
  detail?: string | null;
  errors?: Record<string, string[] | string>;
}

export type Result<T> =
  | ({ ok: true; status: number; exchanges: Exchange[] } & T)
  | { ok: false; status: number; error: ApiError; exchanges: Exchange[] };

export type DemoMethod = 'app-request' | 'web-checkout' | 'in-app' | 'till' | 'invoice';

const SESSION_KEY = 'txgold-demo-session';

/** The session token: from the pay link (a phone that scanned the QR), else this tab's own. */
export function sessionToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function adoptSession(token: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, token);
  } catch {
    /* private mode: the token lives only in this page */
  }
  memoryToken = token;
}

let memoryToken: string | null = null;
let starting: Promise<string> | null = null;

async function ensureSession(): Promise<string> {
  const existing = memoryToken ?? sessionToken();
  if (existing) return existing;
  starting ??= fetch('/api/session', { method: 'POST' })
    .then(async (r) => {
      if (!r.ok) throw new Error(`Could not start a demo session (${r.status}).`);
      const { token } = (await r.json()) as { token: string };
      adoptSession(token);
      return token;
    })
    .finally(() => {
      starting = null;
    });
  return starting;
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, retried = false): Promise<Result<T>> {
  const token = await ensureSession();
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: { 'X-Demo-Session': token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, error: { code: 'sandbox_unavailable', title: 'The demo could not be reached.' }, exchanges: [] };
  }
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const exchanges = (json.exchanges as Exchange[] | undefined) ?? [];
  if (response.status === 401 && !retried) {
    // The session expired: start a new one and try once more
    memoryToken = null;
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    return call(method, path, body, true);
  }
  if (!response.ok) {
    const error = (json.error as ApiError | undefined) ?? { code: `http_${response.status}`, title: `HTTP ${response.status}` };
    return { ok: false, status: response.status, error, exchanges };
  }
  return { ok: true, status: response.status, exchanges, ...(json as T) };
}

let configPromise: Promise<DemoConfig | null> | null = null;

export const api = {
  config(): Promise<DemoConfig | null> {
    configPromise ??= fetch('/api/config')
      .then((r) => (r.ok ? (r.json() as Promise<DemoConfig>) : null))
      .catch(() => null)
      .then((c) => {
        if (!c) configPromise = null;
        return c;
      });
    return configPromise;
  },
  createRequest(body: { method: DemoMethod; amount: string; memo?: string; customer?: number; handle?: string }) {
    return call<{ request: PaymentRequest }>('POST', '/requests', body);
  },
  getRequest(id: string) {
    return call<{ request: PaymentRequest }>('GET', `/requests/${encodeURIComponent(id)}`);
  },
  pay(id: string, customer?: number) {
    return call<{ request: PaymentRequest; payment: Payment }>('POST', `/requests/${encodeURIComponent(id)}/pay`, { customer });
  },
  cancel(id: string) {
    return call<{ request: PaymentRequest }>('POST', `/requests/${encodeURIComponent(id)}/cancel`, {});
  },
  transactions() {
    return call<{ transactions: Transaction[] }>('GET', '/transactions');
  },
};

/** A link a real phone can open: the simulated TxGold app, on this request, in this session. */
export function phoneLink(requestId: string): string {
  const token = memoryToken ?? sessionToken() ?? '';
  return `${location.origin}/pay/${encodeURIComponent(requestId)}?s=${encodeURIComponent(token)}`;
}
