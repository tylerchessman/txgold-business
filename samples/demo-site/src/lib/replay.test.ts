import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import run from '../recorded/run.json';
import { Replay, type Recording } from './replay';
import type { PaymentRequest, Result } from './api';

const recording = run as unknown as Recording;
const NOW = Date.parse('2026-12-01T10:00:00Z');
const replay = () => new Replay(recording, () => NOW);

function ok<T>(result: Result<T>) {
  if (!result.ok) throw new Error(`expected ok: ${JSON.stringify(result)}`);
  return result;
}

describe('the recorded run', () => {
  const { create, pay, ...single } = recording.responses;
  const exchanges = [...Object.values(create), ...Object.values(pay), ...Object.values(single)].flatMap((r) => r.exchanges);

  it('has a response for every operation the page makes', () => {
    expect(Object.keys(recording.responses.create).sort()).toEqual(['app-request', 'in-app', 'invoice', 'till', 'web-checkout']);
    expect(recording.customerAccounts).toHaveLength(recording.config.customers.length);
    expect(exchanges.length).toBeGreaterThan(5);
  });

  it('shows only the Sandbox, and no full signature', () => {
    for (const e of exchanges) {
      expect(e.origin).toBe('https://api-sandbox.txgold.money');
      expect(e.requestHeaders['TxG-Signature']).toMatch(/^.{1,12}…$/);
      expect(e.requestHeaders['TxG-Key-Id']).toMatch(/^.{1,16}…$/);
    }
  });
});

describe('Replay', () => {
  it('creates a request with this run\'s amount, memo, payer and times, everywhere', () => {
    const r = replay();
    const { request, exchanges } = ok(r.createRequest({ method: 'app-request', customer: 2, amount: '1.5', memo: 'Lunch' }));
    expect(request).toMatchObject({ status: 'pending', amount: '1.50', memo: 'Lunch', payerAccountId: recording.customerAccounts[2] });
    expect(request.createdAt).toBe('2026-12-01T10:00:00.000Z');
    expect(request.expiresAt).toBe('2026-12-01T10:15:00.000Z');
    expect(exchanges).toHaveLength(1);
    expect(exchanges[0]).toMatchObject({ method: 'POST', path: '/v1/payment-requests', recorded: true });
    expect(exchanges[0].requestBody).toMatchObject({ amount: '1.50', memo: 'Lunch', payerAccountId: recording.customerAccounts[2], expiresAt: request.expiresAt });
    expect(exchanges[0].responseBody).toMatchObject({ id: request.id, amount: '1.50', memo: 'Lunch', status: 'pending' });
  });

  it('gives each request a new id, and fills the payment link', () => {
    const r = replay();
    const a = ok(r.createRequest({ method: 'till', amount: '2.00', memo: 'Two teas' })).request;
    const b = ok(r.createRequest({ method: 'till', amount: '3.00' })).request;
    expect(a.id).not.toBe(b.id);
    expect(a.isOpen).toBe(true);
    const link = new URL(a.paymentUrl!);
    expect(link.searchParams.get('Amt')).toBe('2.00');
    expect(link.searchParams.get('Memo')).toBe('Two teas');
    expect(new URL(b.paymentUrl!).searchParams.has('Memo')).toBe(false);
  });

  it('checks the handle at checkout, as the demo API does', () => {
    const r = replay();
    const bad = r.createRequest({ method: 'web-checkout', handle: '@nobody', amount: '1.00' });
    expect(bad).toMatchObject({ ok: false, status: 422, error: { code: 'not_a_demo_customer' } });
    const handle = recording.config.customers[1].handle;
    const good = ok(r.createRequest({ method: 'web-checkout', handle: `@${handle.toUpperCase()}`, amount: '1.00' }));
    expect(good.request.payerAccountId).toBe(recording.customerAccounts[1]);
    expect(good.exchanges[0].requestBody).toMatchObject({ payerHandle: handle });
  });

  it('polls, then pays an open request as the chosen customer', () => {
    const r = replay();
    const { request } = ok(r.createRequest({ method: 'in-app', amount: '0.90', memo: 'Espresso' }));
    const polled = ok(r.getRequest(request.id));
    expect(polled.request.status).toBe('pending');
    expect(polled.exchanges[0].path).toBe(`/v1/payment-requests/${request.id}`);

    const paid = ok(r.pay(request.id, 2));
    expect(paid.request).toMatchObject({ status: 'paid', payerAccountId: recording.customerAccounts[2], paymentId: paid.payment.id });
    expect(paid.payment).toMatchObject({ amount: '0.90', memo: 'Espresso', accountId: recording.customerAccounts[2], paymentRequestId: request.id });
    const [payCall, getCall] = paid.exchanges;
    expect(payCall.path).toBe(`/v1/sandbox/payment-requests/${request.id}/pay`);
    expect(payCall.requestBody).toEqual({ payerAccountId: recording.customerAccounts[2] });
    expect(payCall.responseBody).toMatchObject({ id: paid.payment.id, amount: '0.90' });
    expect(getCall.responseBody).toMatchObject({ id: request.id, status: 'paid' });
    expect(ok(r.getRequest(request.id)).request.status).toBe('paid');
    expect(r.pay(request.id, 0)).toMatchObject({ ok: false, status: 409 });
  });

  it('pays a request to a named customer as that customer', () => {
    const r = replay();
    const { request } = ok(r.createRequest({ method: 'app-request', customer: 1, amount: '4.00' }));
    const paid = ok(r.pay(request.id));
    expect(paid.request.payerAccountId).toBe(recording.customerAccounts[1]);
    expect(paid.payment.amount).toBe('4.00');
  });

  it('cancels a pending request, and returns a paid one as it is', () => {
    const r = replay();
    const a = ok(r.createRequest({ method: 'invoice', amount: '1.00' })).request;
    const cancelled = ok(r.cancel(a.id));
    expect(cancelled.request.status).toBe('cancelled');
    expect(cancelled.exchanges[0]).toMatchObject({ method: 'POST', path: `/v1/payment-requests/${a.id}/cancel` });

    const b = ok(r.createRequest({ method: 'invoice', amount: '1.00' })).request;
    ok(r.pay(b.id, 0));
    expect(ok(r.cancel(b.id)).request.status).toBe('paid');
  });

  it("doesn't know other devices' requests, but carries on with this page's live ones", () => {
    const r = replay();
    expect(r.getRequest('999999')).toMatchObject({ ok: false, status: 404 });
    const live = { ...ok(r.createRequest({ method: 'till', amount: '1.00' })).request, id: 'live-7' } as PaymentRequest;
    r.adopt(live);
    expect(ok(r.pay('live-7', 0)).request).toMatchObject({ id: 'live-7', status: 'paid' });
  });

  it('returns the recorded transactions', () => {
    const { transactions, exchanges } = ok(replay().transactions());
    expect(transactions).toEqual(recording.responses.transactions.transactions);
    expect(exchanges.every((e) => e.recorded)).toBe(true);
  });
});

describe('the switch to the recorded run', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
  });
  afterEach(() => vi.unstubAllGlobals());

  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('stays live while the Sandbox answers', async () => {
    const request = { id: '7', status: 'pending' };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/session' ? json(201, { token: 't' }) : json(201, { request, exchanges: [] }))));
    const { api, demoMode } = await import('./api');
    const result = await api.createRequest({ method: 'till', amount: '1.00' });
    expect(result).toMatchObject({ ok: true, request });
    expect(demoMode()).toBe('live');
  });

  it('answers the call that failed from the recording, and stays recorded', async () => {
    const fetch = vi.fn(async (url: string) =>
      url === '/api/session' ? json(201, { token: 't' }) : json(503, { error: { code: 'sandbox_unavailable', title: 'x' }, exchanges: [] }),
    );
    vi.stubGlobal('fetch', fetch);
    const { api, demoMode, onDemoModeChange } = await import('./api');
    const changed = vi.fn();
    onDemoModeChange(changed);

    const created = await api.createRequest({ method: 'till', amount: '1.25' });
    expect(created).toMatchObject({ ok: true, request: { amount: '1.25', status: 'pending' } });
    expect(demoMode()).toBe('recorded');
    expect(changed).toHaveBeenCalledOnce();

    const calls = fetch.mock.calls.length;
    if (!created.ok) throw new Error();
    expect(await api.pay(created.request.id, 0)).toMatchObject({ ok: true, request: { status: 'paid' } });
    expect(fetch.mock.calls.length).toBe(calls); // no more live calls
  });

  it('falls back when the Function itself fails, or nothing answers', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/session' ? json(201, { token: 't' }) : new Response('oops', { status: 500 }))));
    let mod = await import('./api');
    expect(await mod.api.transactions()).toMatchObject({ ok: true });
    expect(mod.demoMode()).toBe('recorded');

    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    mod = await import('./api');
    expect(await mod.api.config()).toEqual(recording.config);
    expect(mod.demoMode()).toBe('recorded');
  });

  it('carries on with a request made live when the Sandbox stops answering', async () => {
    const request = { id: '41', status: 'pending', isOpen: true, amount: '2.00', memo: null, payerAccountId: null };
    let down = false;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/session') return json(201, { token: 't' });
      if (down) return json(503, { error: { code: 'sandbox_unavailable', title: 'x' }, exchanges: [] });
      return json(201, { request, exchanges: [] });
    }));
    const { api } = await import('./api');
    await api.createRequest({ method: 'till', amount: '2.00' });
    down = true;
    expect(await api.getRequest('41')).toMatchObject({ ok: true, request: { id: '41', status: 'pending' } });
    expect(await api.pay('41', 1)).toMatchObject({ ok: true, request: { id: '41', status: 'paid', payerAccountId: recording.customerAccounts[1] } });
  });
});
