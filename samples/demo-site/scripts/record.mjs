// Records a real run of every demo operation, for the page to replay when the Sandbox doesn't
// answer (decision D42). It talks to the demo's own API, so it needs no key:
//
//   node scripts/record.mjs https://demo.txgold.money/api
//   node scripts/record.mjs http://127.0.0.1:7071/api --origin https://api-sandbox.txgold.money
//
// --origin rewrites the Business API origin shown in the recording (for a run against a local host).
// Writes src/recorded/run.json. Each response is stored as the demo API returned it, exchanges and all.
import { writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith('--')) ?? 'http://127.0.0.1:7071/api').replace(/\/$/, '');
const originAt = args.indexOf('--origin');
const origin = originAt >= 0 ? args[originAt + 1] : null;
const out = new URL('../src/recorded/run.json', import.meta.url);

let token;
async function call(method, path, body) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(token ? { 'X-Demo-Session': token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(json.error ?? json)}`);
  return json;
}

const config = await call('GET', '/config');
token = (await call('POST', '/session')).token;
const customers = config.customers.map((c) => c.index);

// 3. A request to a named customer, once per customer to learn their accounts; the first is paid
const directed = [];
for (const customer of customers)
  directed.push(await call('POST', '/requests', { method: 'app-request', customer, amount: '3.50', memo: 'Catering, Friday meeting' }));
const customerAccounts = directed.map((r) => r.request.payerAccountId);
const get = await call('GET', `/requests/${directed[0].request.id}`);
const payDirected = await call('POST', `/requests/${directed[0].request.id}/pay`, {});
let cancel;
for (const r of directed.slice(1)) cancel = await call('POST', `/requests/${r.request.id}/cancel`, {});

// 4. Checkout by handle
const webCheckout = await call('POST', '/requests', { method: 'web-checkout', handle: config.customers[0].handle, amount: '4.20', memo: 'Order 1042: beans, 250 g' });
await call('POST', `/requests/${webCheckout.request.id}/cancel`, {});

// 5 and 6. Open requests; the in-app one is paid by the second customer
const inApp = await call('POST', '/requests', { method: 'in-app', amount: '0.75', memo: 'Flat white' });
const payOpen = await call('POST', `/requests/${inApp.request.id}/pay`, { customer: customers[1] ?? 0 });
const till = await call('POST', '/requests', { method: 'till', amount: '2.80', memo: 'Till 1: cappuccino' });
await call('POST', `/requests/${till.request.id}/cancel`, {});
const invoice = await call('POST', '/requests', { method: 'invoice', amount: '4.50', memo: 'Invoice 2026-118' });
await call('POST', `/requests/${invoice.request.id}/cancel`, {});

// 1 and 2. What the business was paid
const transactions = await call('GET', '/transactions');

const run = {
  recordedAt: new Date().toISOString(),
  config,
  customerAccounts,
  responses: {
    create: { 'app-request': directed[0], 'web-checkout': webCheckout, 'in-app': inApp, till, invoice },
    get,
    pay: { directed: payDirected, open: payOpen },
    cancel,
    transactions,
  },
};

let text = JSON.stringify(run, null, 2);
if (origin) text = text.replace(/"origin": "[^"]*"/g, `"origin": ${JSON.stringify(origin)}`);
await writeFile(out, text + '\n');
console.log(`Recorded ${(text.match(/"origin":/g) ?? []).length} exchanges to ${out.pathname}`);
