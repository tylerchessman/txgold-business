// The page's calls to its own /api (the Function that holds the Sandbox key). Every response
// carries `exchanges`: the Business API calls it made, for the "What just happened" panel.
//
// If the Sandbox (or /api) doesn't answer, the page switches to the recorded run (replay.ts) for
// the rest of the visit, and answers the call that failed from it: the click still works.
import type { CreateBody, Replay } from './replay';

export interface Exchange {
  method: string;
  path: string;
  origin: string;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  status: number;
  responseBody: unknown;
  ms: number;
  /** From the recorded run, not this visit. */
  recorded?: boolean;
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

const unreachable = { ok: false as const, status: 0, error: { code: 'sandbox_unavailable', title: 'The demo could not be reached.' }, exchanges: [] };

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, retried = false): Promise<Result<T>> {
  let response: Response;
  try {
    const token = await ensureSession();
    response = await fetch(`/api${path}`, {
      method,
      headers: { 'X-Demo-Session': token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return unreachable;
  }
  // The Function itself failing (or SWA's gateway) counts as the Sandbox not answering
  if (response.status >= 500 && response.status !== 503) return { ...unreachable, status: response.status };
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

// Live, or the recorded run. It changes once, from live to recorded, and only a reload goes back.
export type DemoMode = 'live' | 'recorded';
let mode: DemoMode = 'live';
const listeners = new Set<() => void>();
export const demoMode = () => mode;
export function onDemoModeChange(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

let replayPromise: Promise<Replay> | null = null;
/** The recorded run, loaded only when it's needed. */
export function replay(): Promise<Replay> {
  replayPromise ??= Promise.all([import('./replay'), import('../recorded/run.json')]).then(
    ([{ Replay }, run]) => new Replay(run.default as never),
  );
  return replayPromise;
}

async function toRecorded() {
  const r = await replay();
  for (const request of seen.values()) r.adopt(request);
  if (mode !== 'recorded') {
    mode = 'recorded';
    listeners.forEach((l) => l());
  }
  return r;
}

/** Requests this page has seen live, for the recorded run to carry on with. */
const seen = new Map<string, PaymentRequest>();

/** A live call, or the recorded run's answer if the Sandbox doesn't answer (now or before). */
async function either<T>(live: () => Promise<Result<T>>, recorded: (r: Replay) => Result<T>): Promise<Result<T>> {
  if (mode === 'live') {
    const result = await live();
    if (result.ok || result.error.code !== 'sandbox_unavailable') {
      const request = result.ok ? (result as { request?: PaymentRequest }).request : undefined;
      if (request) seen.set(request.id, request);
      return result;
    }
  }
  return recorded(await toRecorded());
}

let configPromise: Promise<DemoConfig> | null = null;

export const api = {
  /** The demo's business and customers; from the recorded run if /api doesn't answer. */
  config(): Promise<DemoConfig> {
    configPromise ??= fetch('/api/config')
      .then((r) => (r.ok ? (r.json() as Promise<DemoConfig>) : null))
      .catch(() => null)
      .then(async (c) => c ?? (await toRecorded()).config());
    return configPromise;
  },
  createRequest(body: CreateBody) {
    return either(() => call<{ request: PaymentRequest }>('POST', '/requests', body), (r) => r.createRequest(body));
  },
  getRequest(id: string) {
    return either(() => call<{ request: PaymentRequest }>('GET', `/requests/${encodeURIComponent(id)}`), (r) => r.getRequest(id));
  },
  pay(id: string, customer?: number) {
    return either(
      () => call<{ request: PaymentRequest; payment: Payment }>('POST', `/requests/${encodeURIComponent(id)}/pay`, { customer }),
      (r) => r.pay(id, customer),
    );
  },
  cancel(id: string) {
    return either(() => call<{ request: PaymentRequest }>('POST', `/requests/${encodeURIComponent(id)}/cancel`, {}), (r) => r.cancel(id));
  },
  transactions() {
    return either(() => call<{ transactions: Transaction[] }>('GET', '/transactions'), (r) => r.transactions());
  },
};

/** A link a real phone can open: the simulated TxGold app, on this request, in this session. */
export function phoneLink(requestId: string): string {
  const token = memoryToken ?? sessionToken() ?? '';
  return `${location.origin}/pay/${encodeURIComponent(requestId)}?s=${encodeURIComponent(token)}`;
}
