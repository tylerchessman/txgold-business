// Website checkout: the customer types their TxGold handle, you send them a payment request,
// they approve it in the TxGold app, and your checkout watches for it to be paid.
//
//   TXGOLD_KEY_FILE=txgold-sandbox-mystore.key.json TXGOLD_ACCOUNT_ID=1000002 \
//   TXGOLD_PAYER_HANDLE=Jason-Miles node checkout-handle.mjs
//
// TXGOLD_PAYER_HANDLE is the customer's handle as they typed it (a leading @ is fine). A request
// made by handle never tells you the payer's account id. An unknown handle is a 422
// payer_account_invalid: tell the customer there is no TxGold account with that handle.
import { TxGoldClient, TxGoldApiError, loadKeyFile } from '@txgold/business';

const key = loadKeyFile(required('TXGOLD_KEY_FILE'));
const client = new TxGoldClient({ key, baseUrl: process.env.TXGOLD_BASE_URL, maxRetries: 2 });
const accountId = process.env.TXGOLD_ACCOUNT_ID ?? key.accountId ?? required('TXGOLD_ACCOUNT_ID');
const payerHandle = required('TXGOLD_PAYER_HANDLE');
const inSandbox = (key.environment ?? 'sandbox') === 'sandbox';
const orderId = `order-${Date.now()}`;

try {
  // A request to a named payer: they get a push notification and see it in the app.
  // Give it a short life: a checkout page doesn't wait for days.
  const request = await client.paymentRequests.create({
    accountId,
    payerHandle,
    amount: '1.25',
    memo: 'Acme web shop: 1 coffee mug',
    memoInternal: orderId, // your order id, never shown to the customer
    tag: 'web-checkout',
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  });
  console.log(`Asked @${payerHandle.replace(/^@/, '')} for ${request.amount}: request ${request.id} is ${request.status}`);
  console.log('Waiting for the customer to approve it in the TxGold app...');

  if (inSandbox) {
    // Sandbox only: in production the customer approves in the app. This works when the handle
    // is one of your Sandbox demo customers.
    setTimeout(() => client.sandbox.payRequest(request.id)
      .catch((e) => console.error(`Sandbox pay failed: ${e.message}`)), 3_000);
  }

  const final = await waitWhilePending(request.id, 2 * 60_000);
  if (final.status === 'paid') {
    console.log(`Paid: payment ${final.paymentId}. Fulfil ${orderId}.`);
  } else if (final.status === 'pending') {
    // Timed out: cancel, so the customer can't pay for an order you have abandoned
    const cancelled = await cancel(final.id);
    console.log(`No answer in time: request ${cancelled.id} is ${cancelled.status}`);
  } else {
    console.log(`Not paid: request ${final.id} is ${final.status}`); // dismissed by the customer, or expired
  }
} catch (error) {
  if (error instanceof TxGoldApiError && error.code === 'payer_account_invalid') {
    console.error(`No TxGold account has the handle "${payerHandle}" (${error.status} ${error.code}). Ask the customer to check it.`);
    process.exitCode = 1;
  } else if (error instanceof TxGoldApiError) {
    console.error(`API error ${error.status} ${error.code}: ${error.detail ?? error.title} (request ${error.requestId})`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}

/** Polls the request until it stops being pending or the time is up: 1 s, 2 s, 4 s... at most 10 s apart. */
async function waitWhilePending(requestId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (let wait = 1_000; ; wait = Math.min(wait * 2, 10_000)) {
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
