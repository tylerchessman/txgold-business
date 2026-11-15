import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { TxGoldClient, signingKey } from '@txgold/business';
import { createHandlers, timestampClock } from '../src/lib/handlers.js';
import { RateLimiter, LIMITS, clientIp } from '../src/lib/limits.js';
import { newSession, verifySession, tagFor } from '../src/lib/session.js';
import { parseCustomers } from '../src/lib/config.js';
import { recordingFetch } from '../src/lib/wire.js';

const SECRET = 'x'.repeat(40);

/** A fake Business API: just enough of payment requests, Sandbox pay and transactions. */
function fakeApi({ fail } = {}) {
  const requests = new Map();
  const calls = [];
  let next = 500;
  const fetch = async (url, init) => {
    const { pathname, searchParams } = new URL(url);
    const body = init.body?.length ? JSON.parse(new TextDecoder().decode(init.body)) : undefined;
    calls.push({ method: init.method, path: pathname, body, headers: init.headers });
    const reply = (status, json) => new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
    if (fail) return reply(503, { code: 'service_unavailable', title: 'Down' });

    let m;
    if (init.method === 'GET' && (m = /^\/v1\/accounts\/(\d+)$/.exec(pathname)))
      return reply(200, { id: m[1], accountName: 'TxGDemo', displayName: 'Demo Coffee Co', type: 'business' });
    if (init.method === 'POST' && pathname === '/v1/payment-requests') {
      const id = String(next++);
      const request = {
        id, status: 'pending', accountId: body.accountId, payerAccountId: body.payerAccountId ?? null,
        isOpen: !body.payerAccountId && !body.payerHandle, amount: body.amount, memo: body.memo ?? null,
        tag: body.tag, expiresAt: body.expiresAt, paymentId: null,
        paymentUrl: !body.payerAccountId && !body.payerHandle ? `https://app.txgold.money/RequestPayment?AccountId=${body.accountId}&Seq=1` : null,
      };
      requests.set(id, request);
      return reply(201, request);
    }
    if ((m = /^\/v1\/payment-requests\/(\w+)(\/cancel)?$/.exec(pathname))) {
      const request = requests.get(m[1]);
      if (!request) return reply(404, { code: 'not_found', title: 'Not found' });
      if (m[2]) {
        if (request.status !== 'pending') return reply(409, { code: 'request_not_pending', title: 'Not pending' });
        request.status = 'cancelled';
      }
      return reply(200, request);
    }
    if ((m = /^\/v1\/sandbox\/payment-requests\/(\w+)\/pay$/.exec(pathname))) {
      const request = requests.get(m[1]);
      request.status = 'paid';
      request.paymentId = 'p' + m[1];
      if (request.isOpen) request.payerAccountId = body?.payerAccountId ?? '1000011';
      return reply(201, { id: request.paymentId, amount: request.amount, direction: 'credit' });
    }
    if ((m = /^\/v1\/accounts\/(\d+)\/transactions$/.exec(pathname)))
      return reply(200, { data: [{ id: 't1', direction: 'credit', amount: '1.00' }], nextCursor: null, limit: searchParams.get('limit') });
    return reply(404, { code: 'not_found', title: 'No route' });
  };
  return { fetch, requests, calls };
}

function setup(options = {}) {
  const api = fakeApi(options);
  const key = signingKey(generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey);
  const client = new TxGoldClient({ key, baseUrl: 'https://api.test', fetch: recordingFetch(api.fetch) });
  const config = {
    accountId: '1000010',
    customers: parseCustomers('1000011:TxGDemo-Customer1,1000012:TxGDemo-Customer2'),
    sessionSecret: SECRET,
    maxAmount: '5.00',
  };
  const handlers = createHandlers({ client, config, limiter: new RateLimiter(options.limits ?? LIMITS) });
  const { token, id } = newSession(SECRET);
  return { api, handlers, token, sessionId: id };
}

test('sessions: verify their own tokens, refuse forged and expired ones', () => {
  const { id, token } = newSession(SECRET, Date.UTC(2026, 10, 15));
  assert.equal(verifySession(SECRET, token, Date.UTC(2026, 10, 15, 1)), id);
  assert.equal(verifySession('y'.repeat(40), token, Date.UTC(2026, 10, 15, 1)), null);
  assert.equal(verifySession(SECRET, token.replace(/^./, (c) => (c === 'a' ? 'b' : 'a')), Date.UTC(2026, 10, 15, 1)), null);
  assert.equal(verifySession(SECRET, token, Date.UTC(2026, 10, 16)), null, '12 hours at most');
  assert.equal(verifySession(SECRET, undefined), null);
  assert.equal(tagFor(id).length <= 50, true);
});

test('a website checkout: create by handle, tagged, short-lived; the demo customer pays it', async () => {
  const { api, handlers, token, sessionId } = setup();
  const created = await handlers.createRequest({
    session: token, ip: '1.1.1.1',
    body: { method: 'web-checkout', handle: '@txgdemo-customer2', amount: '1.5', memo: 'Demo Coffee Co: 1 mug' },
  });
  assert.equal(created.status, 201);
  const sent = api.calls.at(-1).body;
  assert.equal(sent.payerHandle, 'TxGDemo-Customer2', 'the canonical handle');
  assert.equal(sent.amount, '1.50');
  assert.equal(sent.tag, tagFor(sessionId));
  assert.ok(Date.parse(sent.expiresAt) - Date.now() <= 15 * 60_000);

  // What the page shows: the exchange, with the signature shortened
  const [exchange] = created.body.exchanges;
  assert.equal(exchange.method, 'POST');
  assert.equal(exchange.path, '/v1/payment-requests');
  assert.equal(exchange.origin, 'https://api.test');
  assert.equal(exchange.status, 201);
  assert.match(exchange.requestHeaders['TxG-Signature'], /…$/);
  assert.equal(exchange.requestBody.payerHandle, 'TxGDemo-Customer2');

  const paid = await handlers.payRequest({ session: token, ip: '1.1.1.1', params: { id: created.body.request.id } });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.request.status, 'paid');
  assert.deepEqual(paid.body.exchanges.map((e) => e.path), [
    `/v1/sandbox/payment-requests/${created.body.request.id}/pay`,
    `/v1/payment-requests/${created.body.request.id}`,
  ]);
  assert.equal(api.calls.at(-2).body, undefined, 'a named request is paid by its own payer: no body');
});

test('an unknown handle is refused before any API call', async () => {
  const { api, handlers, token } = setup();
  const result = await handlers.createRequest({ session: token, ip: 'i', body: { method: 'web-checkout', handle: 'someone-else', amount: '1.00' } });
  assert.equal(result.status, 422);
  assert.equal(result.body.error.code, 'not_a_demo_customer');
  assert.equal(api.calls.length, 0);
});

test('an open request (till) is paid by the chosen demo customer', async () => {
  const { api, handlers, token } = setup();
  const created = await handlers.createRequest({ session: token, ip: 'i', body: { method: 'till', amount: '3.20' } });
  assert.equal(created.status, 201);
  assert.ok(created.body.request.paymentUrl);
  const paid = await handlers.payRequest({ session: token, ip: 'i', params: { id: created.body.request.id }, body: { customer: 1 } });
  assert.equal(paid.status, 200);
  assert.deepEqual(api.calls.at(-2).body, { payerAccountId: '1000012' });
});

test('the browser cannot choose the account, the payer id, or go over the cap', async () => {
  const { api, handlers, token } = setup();
  const bad = await handlers.createRequest({
    session: token, ip: 'i',
    body: { method: 'app-request', customer: 7, amount: '5.01', memo: 'x'.repeat(61), accountId: '1', payerAccountId: '1000001' },
  });
  assert.equal(bad.status, 400);
  assert.deepEqual(Object.keys(bad.body.error.errors).sort(), ['amount', 'customer', 'memo']);
  for (const amount of ['0.02', '-1', '1e2', '1.234', 'abc'])
    assert.equal((await handlers.createRequest({ session: token, ip: 'i', body: { method: 'till', amount } })).status, 400, amount);
  assert.equal((await handlers.createRequest({ session: token, ip: 'i', body: { method: 'refund', amount: '1.00' } })).status, 400);

  const ok = await handlers.createRequest({ session: token, ip: 'i', body: { method: 'app-request', customer: 0, amount: '5', accountId: '1', payerAccountId: '1000001' } });
  assert.equal(ok.status, 201);
  const sent = api.calls.at(-1).body;
  assert.equal(sent.accountId, '1000010');
  assert.equal(sent.payerAccountId, '1000011');
});

test("another session's request is invisible: not shown, not paid, not cancelled", async () => {
  const { api, handlers, token } = setup();
  const created = await handlers.createRequest({ session: token, ip: 'i', body: { method: 'invoice', amount: '2.00' } });
  const other = newSession(SECRET).token;
  const id = created.body.request.id;
  for (const action of ['getRequest', 'payRequest', 'cancelRequest']) {
    const result = await handlers[action]({ session: other, ip: 'i', params: { id }, body: {} });
    assert.equal(result.status, 404, action);
    assert.deepEqual(result.body.exchanges, [], `${action}: nothing about the request leaks`);
  }
  assert.equal(api.requests.get(id).status, 'pending');
  assert.equal((await handlers.getRequest({ session: 'forged', ip: 'i', params: { id } })).status, 401);
});

test('cancel: a request already paid comes back as paid', async () => {
  const { handlers, token } = setup();
  const created = await handlers.createRequest({ session: token, ip: 'i', body: { method: 'in-app', amount: '0.75' } });
  const id = created.body.request.id;
  await handlers.payRequest({ session: token, ip: 'i', params: { id }, body: {} });
  const cancelled = await handlers.cancelRequest({ session: token, ip: 'i', params: { id } });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.request.status, 'paid');
});

test('the Sandbox down: 503 sandbox_unavailable, so the page plays a recorded run', async () => {
  const { handlers, token } = setup({ fail: true });
  const result = await handlers.createRequest({ session: token, ip: 'i', body: { method: 'till', amount: '1.00' } });
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, 'sandbox_unavailable');
});

test('rate limits: per IP and per session', async () => {
  const limits = { ...LIMITS, create: { max: 2, windowMs: 60_000 } };
  const { handlers, token } = setup({ limits });
  const make = (ip) => handlers.createRequest({ session: token, ip, body: { method: 'till', amount: '1.00' } });
  assert.equal((await make('a')).status, 201);
  assert.equal((await make('a')).status, 201);
  assert.equal((await make('a')).status, 429);
  assert.equal((await make('b')).status, 429, 'the session is over too');
});

test('config: the business, the customers by handle only, the cap', async () => {
  const { handlers } = setup();
  const { body } = await handlers.config();
  assert.equal(body.business.displayName, 'Demo Coffee Co');
  assert.deepEqual(body.customers, [{ index: 0, handle: 'TxGDemo-Customer1' }, { index: 1, handle: 'TxGDemo-Customer2' }]);
  assert.equal(body.maxAmount, '5.00');
});

test('timestamps never repeat, even within a millisecond', () => {
  const clock = timestampClock(() => 1_700_000_000_000);
  const seen = new Set(Array.from({ length: 1000 }, clock));
  assert.equal(seen.size, 1000);
});

test('clientIp: SWA forwarding headers', () => {
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.9:51234, 10.0.0.1' })), '203.0.113.9');
  assert.equal(clientIp(new Headers({ 'x-azure-clientip': '2001:db8::1' })), '2001:db8::1');
  assert.equal(clientIp(new Headers()), 'unknown');
});
