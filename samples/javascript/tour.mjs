// A tour of the TxGold Business API in the Sandbox: rates, your account, a payment, a payment
// request that a demo customer pays, a refund, and your transactions.
//
//   npm install @txgold/business
//   TXGOLD_KEY_FILE=txgold-sandbox-mystore.key.json TXGOLD_ACCOUNT_ID=1000002 TXGOLD_CUSTOMER_ID=1000004 node tour.mjs
//
// TXGOLD_ACCOUNT_ID is your business account (the key file's accountId when it has one) and
// TXGOLD_CUSTOMER_ID one of its Sandbox demo customers.
import { TxGoldClient, TxGoldApiError } from '@txgold/business';

const client = new TxGoldClient({
  key: required('TXGOLD_KEY_FILE'),
  baseUrl: process.env.TXGOLD_BASE_URL, // optional: defaults to the key file's environment
  maxRetries: 2,
});
const accountId = process.env.TXGOLD_ACCOUNT_ID ?? required('TXGOLD_ACCOUNT_ID');
const customerId = required('TXGOLD_CUSTOMER_ID');

try {
  const rate = await client.rates.get();
  console.log(`1 TxGold = $${rate.usdPerTxGold} (as of ${rate.asOf})`);

  let account = await client.accounts.get(accountId);
  console.log(`Account ${account.id} @${account.accountName}: balance ${account.balance}`);
  if (account.balance !== null && Number(account.balance) < 5) {
    await client.sandbox.fund(accountId, '10.00');
    account = await client.accounts.get(accountId);
    console.log(`Funded with test TxGold: balance ${account.balance}`);
  }

  // Send a payment. Amounts are decimal strings, never floats.
  const payment = await client.payments.create({
    accountId, destinationAccountId: customerId, amount: '1.00', memo: 'SDK tour: a payment',
  });
  console.log(`Paid ${payment.amount} to ${payment.destinationAccountId}: payment ${payment.id}`);

  // Ask the customer for a payment, and have the Sandbox customer pay it
  const request = await client.paymentRequests.create({
    accountId, payerAccountId: customerId, amount: '0.50', memo: 'SDK tour: a request',
  });
  console.log(`Requested ${request.amount} from ${request.payerAccountId}: request ${request.id} is ${request.status}`);
  const received = await client.sandbox.payRequest(request.id);
  const paid = await client.paymentRequests.get(request.id);
  console.log(`The customer paid it: request ${paid.id} is ${paid.status}, payment ${received.id}`);

  // Refund what the customer paid
  const refund = await client.payments.refund(received.id, { memo: 'SDK tour: a refund' });
  console.log(`Refunded ${refund.amount}: refund ${refund.id}`);

  const page = await client.accounts.transactions(accountId, { limit: 5 });
  console.log('Latest transactions:');
  for (const t of page.data) console.log(`  ${t.createdAt}  ${t.direction.padEnd(6)} ${t.amount.padStart(8)}  ${t.memo ?? ''}`);
} catch (error) {
  if (error instanceof TxGoldApiError) {
    console.error(`API error ${error.status} ${error.code}: ${error.detail ?? error.title} (request ${error.requestId})`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}
