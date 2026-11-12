// A till: each sale gets a fresh open request, shown as a QR code on the customer display. The
// customer scans it, the TxGold app opens on the sale, they pay, and the till sees it.
//
//   TXGOLD_KEY_FILE=txgold-sandbox-mystore.key.json TXGOLD_ACCOUNT_ID=1000002 TXGOLD_CUSTOMER_ID=1000004 node till-qr.mjs
//
// Optional: TXGOLD_AMOUNT (default 1.00); TXGOLD_WAIT_SECONDS, how long the till waits before
// treating the sale as abandoned (default 90); and in the Sandbox TXGOLD_SANDBOX_ABANDON=1 to have
// nobody pay, so you see the till cancel the request.
import { TxGoldClient, TxGoldApiError, loadKeyFile } from '@txgold/business';
import QRCode from 'qrcode';

const key = loadKeyFile(required('TXGOLD_KEY_FILE'));
const client = new TxGoldClient({ key, baseUrl: process.env.TXGOLD_BASE_URL, maxRetries: 2 });
const accountId = process.env.TXGOLD_ACCOUNT_ID ?? key.accountId ?? required('TXGOLD_ACCOUNT_ID');
const inSandbox = (key.environment ?? 'sandbox') === 'sandbox';
const amount = process.env.TXGOLD_AMOUNT ?? '1.00';
const waitMs = Number(process.env.TXGOLD_WAIT_SECONDS ?? 90) * 1_000;
const till = 'till-1';

try {
  // One request per sale, never reused: an open request is paid once. A short expiry means a
  // forgotten QR can't be paid tomorrow, and the tag says which till made it.
  const sale = await client.paymentRequests.create({
    accountId,
    amount,
    memo: 'Acme Coffee, Main St',
    memoInternal: `${till} sale ${Date.now()}`,
    tag: till,
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  });
  console.log(`Sale ${sale.id}: ${sale.amount} TxGold. Scan to pay:`);
  // A terminal QR for this sample; a real till draws the SVG on its customer display
  console.log(await QRCode.toString(sale.paymentUrl, { type: 'terminal', small: true }));
  await QRCode.toFile('till-qr.svg', sale.paymentUrl, { type: 'svg', margin: 2 });

  if (inSandbox && process.env.TXGOLD_SANDBOX_ABANDON !== '1') {
    // Sandbox only: in production the customer scans the QR and approves in the TxGold app
    const customerId = required('TXGOLD_CUSTOMER_ID');
    setTimeout(() => client.sandbox.payRequest(sale.id, { payerAccountId: customerId })
      .catch((e) => console.error(`Sandbox pay failed: ${e.message}`)), 3_000);
  }

  // A customer at the counter pays within seconds: poll often
  const final = await waitWhilePending(sale.id, waitMs);
  if (final.status === 'paid') {
    console.log(`Paid: payment ${final.paymentId}. Print the receipt.`);
  } else if (final.status === 'pending') {
    // Abandoned sale: cancel at once, so the QR (perhaps photographed) stops taking payments
    const cancelled = await cancel(final.id);
    console.log(`Sale abandoned: request ${cancelled.id} is ${cancelled.status}`);
  } else {
    console.log(`Request ${final.id} is ${final.status}`);
  }
} catch (error) {
  if (error instanceof TxGoldApiError) {
    console.error(`API error ${error.status} ${error.code}: ${error.detail ?? error.title} (request ${error.requestId})`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}

/** Polls the request until it stops being pending or the time is up: 1 s, 1.5 s... at most 3 s apart. */
async function waitWhilePending(requestId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (let wait = 1_000; ; wait = Math.min(wait * 1.5, 3_000)) {
    const request = await client.paymentRequests.get(requestId);
    if (request.status !== 'pending' || Date.now() + wait > deadline) return request;
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

/** Cancels a pending request. If it was paid in the meantime, that wins: returns it as it is. */
async function cancel(requestId) {
  try {
    return await client.paymentRequests.cancel(requestId);
  } catch (error) {
    if (error instanceof TxGoldApiError && error.code === 'request_not_pending') return client.paymentRequests.get(requestId);
    throw error;
  }
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}
