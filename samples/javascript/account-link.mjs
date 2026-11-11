// An account link: a QR code that opens the TxGold app ready to pay your account. No API call and
// no key: build it once, print it on a sign, a sticker or a tip jar.
//
//   TXGOLD_ACCOUNT_ID=1000002 TXGOLD_ACCOUNT_NAME=AcmeCoffee node account-link.mjs
//
// Optional: TXGOLD_AMOUNT and TXGOLD_MEMO to suggest an amount and a memo. Writes account-qr.svg.
//
// What the payer sees is only a suggestion: they can change the amount and the memo before paying.
// For a fixed amount (a sale, an invoice) create an open request instead and use its paymentUrl
// (see till-qr.mjs and invoice-link.mjs): that one can't be changed and is paid once.
import QRCode from 'qrcode';

const accountId = required('TXGOLD_ACCOUNT_ID');
const accountName = required('TXGOLD_ACCOUNT_NAME').replace(/^@/, ''); // your handle, without the @

// AccountId is what the app pays, so the link keeps working if you rename your handle;
// AccountName is what it shows while it loads.
const params = [['AccountId', accountId], ['AccountName', accountName]];
if (process.env.TXGOLD_AMOUNT) params.push(['Amt', process.env.TXGOLD_AMOUNT]); // a decimal string, e.g. 5.00
if (process.env.TXGOLD_MEMO) params.push(['Memo', process.env.TXGOLD_MEMO]);

// encodeURIComponent on each value: a memo like "Tips & thanks" must not break the query string
const link = 'https://app.txgold.money/RequestPayment?'
  + params.map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('&');

console.log(link);
await QRCode.toFile('account-qr.svg', link, { type: 'svg', margin: 2 });
console.log('Wrote account-qr.svg');

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}
