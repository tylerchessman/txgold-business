// The six ways to get paid, as the demo presents them, and the sample code behind each step.
import type { SampleFile } from './samples';

export const GUIDE_URL = 'https://docs.txgold.money/guides/ways-to-get-paid';

export interface Way {
  slug: string;
  number: number;
  title: string;
  /** One line on the home page. */
  summary: string;
  bestFor: string;
  code: 'None' | 'API';
  amountFixed: boolean;
  anchor: string;
}

export const WAYS: Way[] = [
  {
    slug: 'your-code', number: 1, title: 'Your QR code', code: 'None', amountFixed: false,
    summary: 'A QR code on the counter that opens the TxGold app ready to pay you. The customer types the amount.',
    bestFor: 'A counter, a tip jar, a donation', anchor: '_1-your-qr-code',
  },
  {
    slug: 'code-with-amount', number: 2, title: 'A QR code with an amount', code: 'None', amountFixed: false,
    summary: 'The same QR code with a suggested amount and memo built in: one per item on a menu or price list.',
    bestFor: 'A price list, a menu', anchor: '_2-a-qr-code-with-an-amount',
  },
  {
    slug: 'request-from-app', number: 3, title: 'A request from the app', code: 'None', amountFixed: true,
    summary: 'Ask a customer you know to pay a set amount. It appears on their phone; they approve it.',
    bestFor: 'Billing someone you know', anchor: '_3-a-request-from-the-app',
  },
  {
    slug: 'website-checkout', number: 4, title: 'Checkout on your website', code: 'API', amountFixed: true,
    summary: 'The customer types their TxGold handle at checkout and approves the order on their phone.',
    bestFor: 'Online orders', anchor: '_4-checkout-on-your-website',
  },
  {
    slug: 'app-checkout', number: 5, title: 'Checkout inside your app', code: 'API', amountFixed: true,
    summary: '"Pay with TxGold" in your own app hands the customer to the TxGold app, then back.',
    bestFor: 'A mobile or web app', anchor: '_5-checkout-inside-your-app',
  },
  {
    slug: 'open-request', number: 6, title: 'An open request: a link or QR', code: 'API', amountFixed: true,
    summary: 'A fresh QR per sale on a till, or a link on an invoice. Whoever has it pays it, once.',
    bestFor: 'Invoices, a till, a QR per sale', anchor: '_6-an-open-request-a-link-or-qr',
  },
];

export const wayBySlug = (slug: string | undefined) => WAYS.find((w) => w.slug === slug);

/** Where each step's code is: a sample file and the text its statement starts with. */
export const STEP_MARKERS = {
  'link.build': { file: 'account-link.mjs', marker: "const link = 'https://app.txgold.money/RequestPayment?'" },
  'link.amount': { file: 'account-link.mjs', marker: 'if (process.env.TXGOLD_AMOUNT) params.push' },
  'link.qr': { file: 'account-link.mjs', marker: "await QRCode.toFile('account-qr.svg'" },
  'tour.create': { file: 'tour.mjs', marker: 'const request = await client.paymentRequests.create({' },
  'tour.pay': { file: 'tour.mjs', marker: 'const received = await client.sandbox.payRequest(request.id);' },
  'tour.get': { file: 'tour.mjs', marker: 'const paid = await client.paymentRequests.get(request.id);' },
  'tour.transactions': { file: 'tour.mjs', marker: 'const page = await client.accounts.transactions(' },
  'checkout.create': { file: 'checkout-handle.mjs', marker: 'const request = await client.paymentRequests.create({' },
  'checkout.pay': { file: 'checkout-handle.mjs', marker: 'setTimeout(() => client.sandbox.payRequest(request.id)' },
  'checkout.wait': { file: 'checkout-handle.mjs', marker: 'const final = await waitWhilePending(request.id' },
  'checkout.paid': { file: 'checkout-handle.mjs', marker: "if (final.status === 'paid') {" },
  'checkout.cancel': { file: 'checkout-handle.mjs', marker: 'const cancelled = await cancel(final.id);' },
  'checkout.unknown': { file: 'checkout-handle.mjs', marker: "error.code === 'payer_account_invalid'" },
  'handoff.create': { file: 'app-handoff.mjs', marker: 'const request = await client.paymentRequests.create({' },
  'handoff.open': { file: 'app-handoff.mjs', marker: '//   Web page / PWA:' },
  'handoff.pay': { file: 'app-handoff.mjs', marker: 'setTimeout(() => client.sandbox.payRequest(request.id, { payerAccountId: customerId })' },
  'handoff.wait': { file: 'app-handoff.mjs', marker: 'const final = await waitWhilePending(request.id' },
  'handoff.paid': { file: 'app-handoff.mjs', marker: "if (final.status === 'paid') {" },
  'handoff.cancel': { file: 'app-handoff.mjs', marker: 'const cancelled = await cancel(final.id);' },
  'till.create': { file: 'till-qr.mjs', marker: 'const sale = await client.paymentRequests.create({' },
  'till.qr': { file: 'till-qr.mjs', marker: "await QRCode.toFile('till-qr.svg', sale.paymentUrl" },
  'till.pay': { file: 'till-qr.mjs', marker: 'setTimeout(() => client.sandbox.payRequest(sale.id' },
  'till.wait': { file: 'till-qr.mjs', marker: 'const final = await waitWhilePending(sale.id, waitMs);' },
  'till.paid': { file: 'till-qr.mjs', marker: "if (final.status === 'paid') {" },
  'till.cancel': { file: 'till-qr.mjs', marker: 'const cancelled = await cancel(final.id);' },
  'invoice.create': { file: 'invoice-link.mjs', marker: 'const request = await client.paymentRequests.create({' },
  'invoice.qr': { file: 'invoice-link.mjs', marker: "await QRCode.toFile('invoice-qr.svg'" },
  'invoice.pay': { file: 'invoice-link.mjs', marker: 'setTimeout(() => client.sandbox.payRequest(request.id, { payerAccountId: customerId })' },
  'invoice.wait': { file: 'invoice-link.mjs', marker: 'const final = await waitWhilePending(request.id, 2 * 60_000);' },
} as const satisfies Record<string, { file: SampleFile; marker: string }>;

export type StepName = keyof typeof STEP_MARKERS;
