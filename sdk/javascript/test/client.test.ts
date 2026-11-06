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
  assert.throws(() => new TxGoldClient({ key, environment: 'production' }), /pass baseUrl/);
});
