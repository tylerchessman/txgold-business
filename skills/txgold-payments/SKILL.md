---
name: txgold-payments
description: Send and receive TxGold with the TxGold Business API - sending payments, refunds, payment requests to a customer by account id or handle, open payment requests with a paymentUrl link or QR code (invoices, tills, checkout pages), checking whether a request was paid, cancelling, and paying requests in the Sandbox. Use this skill whenever code pays out TxGold, charges a customer a fixed amount, builds a TxGold checkout or invoice, refunds a TxGold payment, or reads payment status (POST /v1/payments, /v1/payments/{id}/refunds, /v1/payment-requests) - even if the user only says "charge", "invoice", "checkout", "payout" or "get paid" with TxGold. Read the txgold-business-api skill too for client setup, signing and errors; for "approve now, charge the real amount later" use txgold-holds instead.
---

# TxGold payments and payment requests

For the client, signing, errors and the Sandbox, see the `txgold-business-api` skill. Guides:
https://docs.txgold.money/guides/payments, /guides/payment-requests, /guides/ways-to-get-paid.

## Choosing how to get paid

| You want | Use |
|---|---|
| A fixed amount from a known customer, approved in their app | A **payment request** to `payerAccountId` / `payerHandle` |
| A fixed amount from whoever scans a link or QR (invoice, till, web checkout) | An **open payment request** and its `paymentUrl` |
| To charge an amount you only know later (fuel, rental) | A **hold**: `txgold-holds` |
| To pay someone (payouts, refunds of non-TxGold sales, suppliers) | A **payment** |

Customers pay in the TxGold app; there is no card-style "charge without asking". Every payment from
a customer is something they approve on their phone, so treat it as asynchronous.

## Payments (you pay)

```js
const payment = await client.payments.create({
  accountId: '1000002',            // yours: the account paying
  destinationAccountId: '1000004', // who is paid
  amount: '12.50',                 // decimal string, 2 places
  memo: 'Refund for order 8812',   // shown to both sides, 150 chars
  memoInternal: 'order-8812',      // yours only: your reference for reconciliation
});
// payment.id, payment.balanceAfter (if the role may see balances)
```

Python: `client.payments.create("1000002", "12.50", destination_account_id="1000004", memo=…, memo_internal=…)`.
C#: `client.Payments.CreateAsync(new PaymentCreate { AccountId = …, DestinationAccountId = …, Amount = 12.50m, … })`.

- Only the Integration role (or Admin/Manager) may send.
- `paymentRequestId` instead of `destinationAccountId` pays a request addressed **to you** (amount
  must equal it).
- `GET /v1/payments/{id}?accountId=…` (`payments.get(id, accountId)`): `direction` is `debit` or
  `credit` from your side; `fee` is TxGold's fee, paid by the recipient.
- Business errors: `insufficient_balance`, `daily_send_limit_exceeded`,
  `recipient_balance_limit_exceeded`, `destination_account_invalid`, `same_account`,
  `amount_below_minimum`, `identity_check_required`.
- Make it retry-safe (`maxRetries`, or keep and reuse the `timestamp`): see the base skill.

## Refunds (you give a received payment back)

```js
await client.payments.refund(paymentId, { amount: '5.00', memo: 'Partial refund' }); // omit amount for all of it
```

One refund per payment, in full or in part, at most the amount paid; TxGold's fee isn't returned.
Errors: `already_refunded`, `refund_exceeds_original`. Device keys may refund; "Device, no refunds"
keys may not.

## Payment requests (you ask to be paid)

```js
const request = await client.paymentRequests.create({
  accountId: '1000002',
  payerHandle: 'Jason-Miles',      // or payerAccountId; or neither for an open request
  amount: '12.50',                 // the payer must pay exactly this
  memo: 'Invoice 4411',
  memoInternal: 'inv-4411',
  tag: 'web-checkout',             // yours: a till, device or campaign (50 chars)
  // expiresAt: '2026-12-01T00:00:00Z'
});
```

Python: `client.payment_requests.create("1000002", "1000004", "12.50", memo="Invoice 4411")` (payer
account id positional; `payer_handle=` for a handle). C#: `PaymentRequests.CreateAsync(new PaymentRequestCreate { … })`.

- **To a payer:** they get a push and a card in the app. Expires after 7 days by default (at most 7).
  A request by handle never reveals the payer's account id (`payerAccountId` stays null).
- **Open** (no payer): nobody is notified; you get `paymentUrl` to share or draw as a QR code. Paid
  once by whoever pays first. Expires after 30 days by default, at most 90: for a till, set
  `expiresAt` a few minutes out and cancel it when the sale is abandoned. The link carries the
  amount for display only; the app shows and charges what TxGold stored.
- Statuses: `pending`, `paid` (see `paymentId`), `dismissed` (by the payer), `cancelled` (by you),
  `expired`. Unknown future values: treat as not paid.
- **Learn it was paid:** poll
  `paymentRequests.get(id)` with a backoff until it leaves `pending` or `expiresAt` passes.
  `listAll(accountId, { status: 'pending' })` walks your open ones.
- Cancel: `paymentRequests.cancel(id)`. A second cancel gives `request_not_pending`: treat as done.
- Errors: `payer_account_invalid`, `amount_must_match_request`, `payment_request_not_payable`,
  `payment_request_already_paid`.

## Codes without an API call

A business's own TxGold QR code ("pay us any amount") and a code with a suggested amount are links
the app understands; they need no API call, and the payer can change the amount. Use a payment
request whenever the amount must be exact. See https://docs.txgold.money/guides/ways-to-get-paid.

## Sandbox

`client.sandbox.payRequest(request.id)` has the demo customer pay it (open request: pass
`{ payerAccountId }` or let your first demo customer pay). `client.sandbox.fund(accountId, '50.00')`
tops up an account. Sandbox `paymentUrl`s open the real app, which can't see them.

## Reconciliation

Put your own order or invoice id in `memoInternal` on everything you create, and store TxGold's ids
(`payment.id`, `request.id`). `GET /v1/accounts/{id}/transactions` (`transactionsAll`) lists history
with dates and filters, newest first, for matching.
