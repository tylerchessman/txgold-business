import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type ApiError, type DemoMethod, type Exchange, type PaymentRequest, type Result } from './api';

/** One line of the "What just happened" panel: an API exchange, or a note about the simulation. */
export type LogEntry =
  | { kind: 'exchange'; id: number; step: string; exchange: Exchange; repeats: number }
  | { kind: 'note'; id: number; text: string; tone: 'info' | 'simulated' | 'error' };

let nextId = 1;

/** The log, with consecutive identical polls folded into one entry ("×4"). */
export function useLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  const addExchanges = useCallback((step: string, exchanges: Exchange[]) => {
    setEntries((current) => {
      const out = [...current];
      for (const exchange of exchanges) {
        const last = out[out.length - 1];
        if (
          last?.kind === 'exchange' && exchange.method === 'GET' && last.exchange.method === 'GET'
          && last.exchange.path === exchange.path && last.exchange.status === exchange.status
          && statusOf(last.exchange) === statusOf(exchange)
        ) {
          out[out.length - 1] = { ...last, exchange, repeats: last.repeats + 1 };
        } else {
          out.push({ kind: 'exchange', id: nextId++, step, exchange, repeats: 1 });
        }
      }
      return out;
    });
  }, []);

  const note = useCallback((text: string, tone: 'info' | 'simulated' | 'error' = 'info') => {
    setEntries((current) => [...current, { kind: 'note', id: nextId++, text, tone }]);
  }, []);

  const clear = useCallback(() => setEntries([]), []);
  // The actions keep their identity across renders, so effects that use them don't restart
  const actions = useMemo(() => ({ addExchanges, note, clear }), [addExchanges, note, clear]);
  return [entries, actions] as const;
}

const statusOf = (e: Exchange) => (e.responseBody as { status?: string } | null)?.status;

export type Log = ReturnType<typeof useLog>[1];

interface Options {
  /** How long the business waits for the customer before cancelling. */
  timeoutMs: number;
  /** The text in the log when the wait runs out. */
  timeoutNote?: string;
}

/**
 * One payment request's life, as the business's code sees it: create, poll while pending (1 s,
 * then 1.5x, at most 3 s apart, like till-qr.mjs), cancel when the wait runs out.
 */
export function useDemoRequest(log: Log, { timeoutMs, timeoutNote }: Options) {
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [declined, setDeclined] = useState(false);
  const live = useRef(true);
  const current = useRef<PaymentRequest | null>(null);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const apply = useCallback(<T extends { request: PaymentRequest }>(step: string, result: Result<T>) => {
    log.addExchanges(step, result.exchanges);
    if (result.ok) {
      current.current = result.request;
      setRequest(result.request);
      setError(null);
    } else {
      setError(result.error);
      log.note(`${result.error.title}${result.error.detail ? ` ${result.error.detail}` : ''}`, 'error');
    }
    return result;
  }, [log]);

  const create = useCallback(async (body: { method: DemoMethod; amount: string; memo?: string; customer?: number; handle?: string }) => {
    setBusy(true);
    setRequest(null);
    setDeclined(false);
    current.current = null;
    try {
      const result = apply('Create the payment request', await api.createRequest(body));
      if (result.ok) setDeadline(Date.now() + timeoutMs);
      return result;
    } finally {
      setBusy(false);
    }
  }, [apply, timeoutMs]);

  const pay = useCallback(async (customer?: number) => {
    const id = current.current?.id;
    if (!id) return;
    setBusy(true);
    log.note('Simulated: the customer taps Approve in the TxGold app. The Sandbox pays for them.', 'simulated');
    try {
      apply('The customer pays (Sandbox)', await api.pay(id, customer));
    } finally {
      setBusy(false);
    }
  }, [apply, log]);

  const cancel = useCallback(async (step = 'Cancel the request') => {
    const id = current.current?.id;
    if (!id) return;
    setBusy(true);
    try {
      apply(step, await api.cancel(id));
    } finally {
      setBusy(false);
    }
  }, [apply]);

  /**
   * The customer declines. The Sandbox has no "decline" (in the app the request becomes
   * dismissed), so the demo cancels it and the phone still says it was declined.
   */
  const decline = useCallback(async (note = 'Simulated: the customer declines. The Sandbox has no "decline", so the demo cancels the request; in the app it would be dismissed.') => {
    log.note(note, 'simulated');
    setDeclined(true);
    await cancel('The customer declines (the demo cancels)');
  }, [cancel, log]);

  const reset = useCallback(() => {
    current.current = null;
    setDeclined(false);
    setRequest(null);
    setError(null);
    setDeadline(null);
  }, []);

  // Poll while pending; cancel when the wait runs out
  const pending = request?.status === 'pending';
  const requestId = request?.id;
  useEffect(() => {
    if (!pending || !requestId || deadline === null) return;
    let wait = 1_000;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      if (stopped || !live.current) return;
      if (Date.now() >= deadline) {
        if (timeoutNote) log.note(timeoutNote);
        await cancel('Time is up: cancel the request');
        return;
      }
      const result = await api.getRequest(requestId);
      if (stopped || !live.current) return;
      apply('Wait for the customer (poll)', result);
      if (result.ok && result.request.status !== 'pending') return;
      wait = Math.min(wait * 1.5, 3_000);
      timer = setTimeout(tick, wait);
    };
    timer = setTimeout(tick, wait);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [pending, requestId, deadline, apply, cancel, log, timeoutNote]);

  return { request, error, busy, deadline, declined, create, pay, cancel, decline, reset };
}
