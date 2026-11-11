// An invoice link: an open request (no payer named) that anyone with its link can pay once.
// Put paymentUrl in an email or on a PDF invoice, with its QR code; opening it on a phone opens
// the TxGold app on the request.
//
//   TXGOLD_KEY_FILE=txgold-sandbox-mystore.key.json TXGOLD_ACCOUNT_ID=1000002 TXGOLD_CUSTOMER_ID=1000004 node invoice-link.mjs
//
// Writes invoice-qr.svg and invoice-qr.png. In the Sandbox, TXGOLD_CUSTOMER_ID (one of your demo
// customers) pays the invoice.
import { TxGoldClient, TxGoldApiError, loadKeyFile } from '@txgold/business';
import QRCode from 'qrcode';

const key = loadKeyFile(required('TXGOLD_KEY_FILE'));
const client = new TxGoldClient({ key, baseUrl: process.env.TXGOLD_BASE_URL, maxRetries: 2 });
const accountId = process.env.TXGOLD_ACCOUNT_ID ?? key.accountId ?? required('TXGOLD_ACCOUNT_ID');
const inSandbox = (key.environment ?? 'sandbox') === 'sandbox';
const invoiceNumber = `INV-${Date.now() % 100_000}`;

try {
  // No payerAccountId or payerHandle: the request is open. Nobody is notified; you share the link.
  // An open request expires in 30 days unless you say otherwise (at most 90).
  const request = await client.paymentRequests.create({
    accountId,
    amount: '1.50',
    memo: `Invoice ${invoiceNumber}`, // shown to the payer
    memoInternal: invoiceNumber,
    tag: 'invoices', // your label, never shown: find requests by it later
  });
  console.log(`Invoice ${invoiceNumber}: request ${request.id} (open: ${request.isOpen}) is ${request.status}, expires ${request.expiresAt}`);
  console.log(`Payment link: ${request.paymentUrl}`);

  // Editing the link's Amt or Memo changes nothing: the app shows, and the payer must pay, what
  // the request holds.
  await QRCode.toFile('invoice-qr.svg', request.paymentUrl, { type: 'svg', margin: 2 });
  await QRCode.toFile('invoice-qr.png', request.paymentUrl, { width: 400, margin: 2 });
  console.log('Wrote invoice-qr.svg and invoice-qr.png');

  if (inSandbox) {
    // Sandbox only: in production the customer opens the link and pays in the TxGold app.
    // For an open request you name which demo customer pays.
    const customerId = required('TXGOLD_CUSTOMER_ID');
    setTimeout(() => client.sandbox.payRequest(request.id, { payerAccountId: customerId })
      .catch((e) => console.error(`Sandbox pay failed: ${e.message}`)), 3_000);
  }

  // An invoice can wait days: in a real system poll every few minutes (or have a scheduled job
  // list your pending requests). Here: a couple of minutes, then leave it open.
  const final = await waitWhilePending(request.id, 2 * 60_000);
  if (final.status === 'paid')
    console.log(`Paid by account ${final.payerAccountId}: payment ${final.paymentId}`);
  else
    console.log(`Request ${final.id} is ${final.status}; cancel it with paymentRequests.cancel if the invoice is void.`);
} catch (error) {
  if (error instanceof TxGoldApiError) {
    console.error(`API error ${error.status} ${error.code}: ${error.detail ?? error.title} (request ${error.requestId})`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}

/** Polls the request until it stops being pending or the time is up: 2 s, 4 s, 8 s... at most 30 s apart. */
async function waitWhilePending(requestId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (let wait = 2_000; ; wait = Math.min(wait * 2, 30_000)) {
    const request = await client.paymentRequests.get(requestId);
    if (request.status !== 'pending' || Date.now() + wait > deadline) return request;
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}
