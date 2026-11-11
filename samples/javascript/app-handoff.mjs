// App handoff: your own app (a marketplace, a game, a booking app) asks for a payment and hands
// the customer straight to the TxGold app to approve it, then carries on when it is paid.
//
//   TXGOLD_KEY_FILE=txgold-sandbox-mystore.key.json TXGOLD_ACCOUNT_ID=1000002 TXGOLD_CUSTOMER_ID=1000004 node app-handoff.mjs
//
// Your server creates an open request and gives its paymentUrl to your app; the app opens it, and
// on a phone with TxGold installed that opens the TxGold app on the request. Keep the signing key
// on your server: never ship it inside a mobile or web app.
import { TxGoldClient, TxGoldApiError, loadKeyFile } from '@txgold/business';

const key = loadKeyFile(required('TXGOLD_KEY_FILE'));
const client = new TxGoldClient({ key, baseUrl: process.env.TXGOLD_BASE_URL, maxRetries: 2 });
const accountId = process.env.TXGOLD_ACCOUNT_ID ?? key.accountId ?? required('TXGOLD_ACCOUNT_ID');
const inSandbox = (key.environment ?? 'sandbox') === 'sandbox';
const bookingId = `booking-${Date.now()}`;

try {
  // Server side: one open request for this checkout, alive only as long as the checkout is
  const request = await client.paymentRequests.create({
    accountId,
    amount: '0.75',
    memo: 'Acme Rides: trip to the airport',
    memoInternal: bookingId,
    tag: 'rides-app',
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  console.log(`Request ${request.id} is ${request.status}. Hand this to the app:`);
  console.log(request.paymentUrl);

  // App side: open the link, and the TxGold app opens on the request. For example:
  //
  //   Web page / PWA:           window.location.href = paymentUrl;
  //   React Native / Expo:      await Linking.openURL(paymentUrl);
  //   Capacitor:                await AppLauncher.openUrl({ url: paymentUrl });  // @capacitor/app-launcher
  //   Android (Kotlin):         startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(paymentUrl)))
  //   iOS (Swift):              UIApplication.shared.open(URL(string: paymentUrl)!)
  //
  // Then wait for the payment on your server (below) and tell the app, e.g. when it comes back to
  // the foreground and asks.

  if (inSandbox) {
    // Sandbox only: in production the customer approves in the TxGold app
    const customerId = required('TXGOLD_CUSTOMER_ID');
    setTimeout(() => client.sandbox.payRequest(request.id, { payerAccountId: customerId })
      .catch((e) => console.error(`Sandbox pay failed: ${e.message}`)), 3_000);
  }

  const final = await waitWhilePending(request.id, 2 * 60_000);
  if (final.status === 'paid') {
    console.log(`Paid by account ${final.payerAccountId}: payment ${final.paymentId}. Confirm ${bookingId}.`);
  } else if (final.status === 'pending') {
    const cancelled = await cancel(final.id); // the customer gave up: don't leave a payable link behind
    console.log(`Not paid in time: request ${cancelled.id} is ${cancelled.status}`);
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

/** Polls the request until it stops being pending or the time is up: 1 s, 2 s, 4 s... at most 5 s apart. */
async function waitWhilePending(requestId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (let wait = 1_000; ; wait = Math.min(wait * 2, 5_000)) {
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
