import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { TxGoldClient } from '../src/client.js';
import { TxGoldApiError } from '../src/errors.js';
import { signingKey } from '../src/keys.js';
import { canonicalString, verifyCanonical } from '../src/signing.js';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const key = signingKey(privateKey);

interface Sent { url: URL; method: string; headers: Record<string, string>; body: Uint8Array }

function fakeFetch(responses: Array<{ status: number; body?: unknown } | Error>) {
  const sent: Sent[] = [];
  const impl = (async (input: string | URL, init?: RequestInit) => {
    sent.push({
      url: new URL(String(input)),
      method: init!.method!,
      headers: init!.headers as Record<string, string>,
      body: (init!.body as Uint8Array | undefined) ?? new Uint8Array(0),
    });
    const next = responses.shift()!;
    if (next instanceof Error) throw next;
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), { status: next.status });
  }) as typeof fetch;
  return { sent, impl };
}

function client(fetchImpl: typeof fetch, maxRetries = 0) {
  return new TxGoldClient({ key, baseUrl: 'https://api.test/', fetch: fetchImpl, maxRetries });
}

// The server rebuilds the canonical string from the request it receives; so does this
function assertSigned(s: Sent) {
  const canonical = canonicalString(s.method, s.url.pathname, s.url.search.replace(/^\?/, ''), s.headers['TxG-Timestamp'], s.body);
  assert.equal(s.headers['TxG-Key-Id'], key.keyId);
  assert.ok(verifyCanonical(publicKey, canonical, s.headers['TxG-Signature'], 'ieee-p1363'), 'signature over the sent request');
}

test('a POST signs exactly the bytes it sends, non-ASCII included', async () => {
  const { sent, impl } = fakeFetch([{ status: 201, body: { id: '88' } }]);
  const payment = await client(impl).payments.create({ accountId: '1000002', destinationAccountId: '1000004', amount: '1.25', memo: 'Café ☕' });
  assert.equal(payment.id, '88');
  const s = sent[0];
  assert.equal(s.url.href, 'https://api.test/v1/payments');
  assert.equal(s.headers['Content-Type'], 'application/json');
  assert.equal(JSON.parse(Buffer.from(s.body).toString('utf8')).memo, 'Café ☕');
  assertSigned(s);
});

test('a GET signs its query string as sent', async () => {
  const { sent, impl } = fakeFetch([{ status: 200, body: { data: [], nextCursor: null } }]);
  await client(impl).accounts.transactions('1000002', { from: '2026-11-01T00:00:00+05:00', limit: 10, cursor: 'a+b/c=' });
  const s = sent[0];
  assert.equal(s.url.pathname, '/v1/accounts/1000002/transactions');
  assert.equal(s.url.searchParams.get('from'), '2026-11-01T00:00:00+05:00');
  assert.equal(s.url.searchParams.get('cursor'), 'a+b/c=');
  assert.equal(s.body.length, 0);
  assertSigned(s);
});

test('timestamps never repeat within a client', async () => {
  const { sent, impl } = fakeFetch(Array.from({ length: 20 }, () => ({ status: 200, body: {} })));
  const c = client(impl);
  await Promise.all(Array.from({ length: 20 }, () => c.rates.get()));
  assert.equal(new Set(sent.map((s) => s.headers['TxG-Timestamp'])).size, 20);
});

test('an explicit timestamp is used as given (idempotent resend)', async () => {
  const { sent, impl } = fakeFetch([{ status: 200, body: { id: '88' } }]);
  await client(impl).payments.create({ accountId: '1', destinationAccountId: '2', amount: '1.00' }, { timestamp: '639283104000000000' });
  assert.equal(sent[0].headers['TxG-Timestamp'], '639283104000000000');
  assertSigned(sent[0]);
});

test('problem+json becomes TxGoldApiError', async () => {
  const problem = { type: 'https://docs.txgold.money/errors/insufficient_balance', title: 'Insufficient balance', status: 422,
    code: 'insufficient_balance', detail: 'The account cannot cover 5.00.', requestId: 'abc123' };
  const { impl } = fakeFetch([{ status: 422, body: problem }]);
  await assert.rejects(client(impl).payments.create({ accountId: '1', destinationAccountId: '2', amount: '5.00' }), (e: unknown) => {
    assert.ok(e instanceof TxGoldApiError);
    assert.equal(e.status, 422);
    assert.equal(e.code, 'insufficient_balance');
    assert.equal(e.requestId, 'abc123');
    return true;
  });
});

test('retries resend the identical signed request', async () => {
  const { sent, impl } = fakeFetch([new Error('socket hang up'), { status: 503, body: {} }, { status: 201, body: { id: '9' } }]);
  const payment = await client(impl, 2).payments.create({ accountId: '1', destinationAccountId: '2', amount: '1.00' });
  assert.equal(payment.id, '9');
  assert.equal(sent.length, 3);
  assert.equal(new Set(sent.map((s) => s.headers['TxG-Timestamp'] + s.headers['TxG-Signature'])).size, 1);
});

test('no retries by default', async () => {
  const { sent, impl } = fakeFetch([{ status: 503, body: { code: 'rate_unavailable', status: 503 } }]);
  await assert.rejects(client(impl).rates.get(), TxGoldApiError);
  assert.equal(sent.length, 1);
});

test('listAll follows nextCursor', async () => {
  const { sent, impl } = fakeFetch([
    { status: 200, body: { data: [{ id: '1' }, { id: '2' }], nextCursor: 'next' } },
    { status: 200, body: { data: [{ id: '3' }], nextCursor: null } },
  ]);
  const ids: string[] = [];
  for await (const r of client(impl).paymentRequests.listAll('1000002', { status: 'pending' })) ids.push(r.id);
  assert.deepEqual(ids, ['1', '2', '3']);
  assert.equal(sent[1].url.searchParams.get('cursor'), 'next');
  assert.equal(sent[1].url.searchParams.get('status'), 'pending');
});

test('an environment without a known URL needs baseUrl', () => {
  assert.throws(() => new TxGoldClient({ key, environment: 'staging' }), /pass baseUrl/);
});

test('each environment has its URL', () => {
  assert.equal(new TxGoldClient({ key, environment: 'sandbox' }).baseUrl, 'https://api-sandbox.txgold.money');
  assert.equal(new TxGoldClient({ key, environment: 'production' }).baseUrl, 'https://api.txgold.money');
});

const bodyOf = (s: Sent) => (s.body.length ? JSON.parse(Buffer.from(s.body).toString('utf8')) : undefined);

test('an open request sends no payer, and its link and tag come back', async () => {
  const response = { id: '501', status: 'pending', accountId: '1000002', payerAccountId: null, isOpen: true, amount: '4.00',
    memo: 'Invoice 7', memoInternal: null, createdAt: '2026-11-11T00:00:00Z', expiresAt: '2026-12-11T00:00:00Z',
    statusChangedAt: null, paymentId: null, tag: 'invoices',
    paymentUrl: 'https://app.txgold.money/RequestPayment?AccountId=1000002&AccountName=acme&Amt=4.00&Memo=Invoice%207&Request=12' };
  const { sent, impl } = fakeFetch([{ status: 201, body: response }]);
  const request = await client(impl).paymentRequests.create({ accountId: '1000002', amount: '4.00', memo: 'Invoice 7', tag: 'invoices' });
  assert.deepEqual(bodyOf(sent[0]), { accountId: '1000002', amount: '4.00', memo: 'Invoice 7', tag: 'invoices' });
  assert.equal(request.isOpen, true);
  assert.equal(request.payerAccountId, null);
  assert.equal(request.tag, 'invoices');
  assert.equal(new URL(request.paymentUrl!).searchParams.get('Request'), '12');
  assertSigned(sent[0]);
});

test('a request by payer handle sends payerHandle and tag', async () => {
  const { sent, impl } = fakeFetch([{ status: 201, body: { id: '502', isOpen: false, payerAccountId: null, paymentUrl: null } }]);
  const request = await client(impl).paymentRequests.create({ accountId: '1000002', payerHandle: '@Jason-Miles', amount: '1.50', tag: 'web' });
  assert.deepEqual(bodyOf(sent[0]), { accountId: '1000002', payerHandle: '@Jason-Miles', amount: '1.50', tag: 'web' });
  assert.equal(request.paymentUrl, null);
  assertSigned(sent[0]);
});

test('sandbox payRequest sends a body only when a payer is given', async () => {
  const { sent, impl } = fakeFetch([{ status: 201, body: { id: '1' } }, { status: 201, body: { id: '2' } }, { status: 201, body: { id: '3' } }]);
  const c = client(impl);
  await c.sandbox.payRequest('501');
  await c.sandbox.payRequest('502', { payerAccountId: '1000004' });
  await c.sandbox.payRequest('503', { timestamp: '639283104000000000' }); // the 0.1 (requestId, options) shape
  assert.equal(sent[0].url.pathname, '/v1/sandbox/payment-requests/501/pay');
  assert.equal(sent[0].body.length, 0);
  assert.equal(sent[0].headers['Content-Type'], undefined);
  assert.deepEqual(bodyOf(sent[1]), { payerAccountId: '1000004' });
  assert.equal(sent[1].headers['Content-Type'], 'application/json');
  assert.equal(sent[2].body.length, 0);
  assert.equal(sent[2].headers['TxG-Timestamp'], '639283104000000000');
  for (const s of sent) assertSigned(s);
});

test('error codes the SDK does not know pass through', async () => {
  const { impl } = fakeFetch([{ status: 409, body: { code: 'payment_request_already_paid', title: 'Already paid', status: 409 } }]);
  await assert.rejects(client(impl).payments.create({ accountId: '1', amount: '1.00', paymentRequestId: '501' }), (e: unknown) => {
    assert.ok(e instanceof TxGoldApiError);
    assert.equal(e.status, 409);
    assert.equal(e.code, 'payment_request_already_paid');
    return true;
  });
});
