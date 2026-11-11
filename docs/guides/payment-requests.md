# Payment requests

A payment request asks to be paid a fixed amount. There are two kinds:

- **To a payer:** you name the account that should pay. They get a push notification and a card
  on their TxGold home screen, and pay with a tap.
- **Open:** you name nobody. You get a `paymentUrl` to share or show as a QR code, and whoever
  opens it can pay, once.

Either way, you see the request turn `paid`. To pick the right one for your situation, see
[Ways to get paid](/guides/ways-to-get-paid).

## Create a request

```http
POST /v1/payment-requests
{
  "accountId": "1000007",
  "payerAccountId": "1000006",
  "amount": "12.50",
  "memo": "Invoice 4411",
  "memoInternal": "order-88231",
  "expiresAt": "2026-11-04T00:00:00Z",
  "tag": "web-shop"
}
```

| Field | |
|---|---|
| `accountId` | Your account, which will be paid. |
| `payerAccountId` | The account asked to pay. Optional: see the payer fields below. |
| `payerHandle` | The payer by TxGold handle, instead of `payerAccountId`. Optional. |
| `amount` | A decimal string, at most 2 places. A business or charity must ask for more than 0.02. |
| `memo` | Shown to the payer, and becomes the payment's memo. Up to 150 characters. |
| `memoInternal` | Your own reference, never shown to the payer. Up to 150 characters. |
| `expiresAt` | Optional. At least 1 minute ahead. To a payer: at most 7 days, and 7 days if left out. Open: at most 90 days, and 30 if left out. |
| `tag` | Optional. Your own label: a till, a device, a campaign. Never shown to the payer. Up to 50 characters. |

**The payer fields.** Give `payerAccountId`, or `payerHandle`, or neither:

| You give | You get |
|---|---|
| `payerAccountId` | A request to that account. |
| `payerHandle` | A request to the account with that handle, exactly (a leading `@` is ignored). It's what a customer types at your checkout. The payer's account id is never returned to you, so a handle can't be turned into an id. An unknown handle is [`payer_account_invalid`](/errors/payer_account_invalid). |
| Neither | An **open request**, below. |

Both together is [`invalid_request`](/errors/invalid_request).

The answer is **201**:

```json
{
  "id": "918",
  "status": "pending",
  "accountId": "1000007",
  "payerAccountId": "1000006",
  "isOpen": false,
  "amount": "12.50",
  "memo": "Invoice 4411",
  "memoInternal": "order-88231",
  "createdAt": "2026-10-30T16:10:00.000Z",
  "expiresAt": "2026-11-04T00:00:00.000Z",
  "statusChangedAt": null,
  "paymentId": null,
  "tag": "web-shop",
  "paymentUrl": null
}
```

Resending the identical signed request returns the same request with **200**.

The Integration and Device roles can create requests; Device-no-refunds can't.

## Open requests

Leave out the payer and the request is open:

```http
POST /v1/payment-requests
{ "accountId": "1000007", "amount": "12.50", "memo": "Invoice 4411", "tag": "till-3" }
```

```json
{
  "id": "919",
  "status": "pending",
  "accountId": "1000007",
  "payerAccountId": null,
  "isOpen": true,
  "amount": "12.50",
  "memo": "Invoice 4411",
  "expiresAt": "2026-11-29T16:10:00.000Z",
  "tag": "till-3",
  "paymentUrl": "https://app.txgold.money/RequestPayment?AccountId=1000007&AccountName=PoolMan&Amt=12.50&Memo=Invoice%204411&Request=638923456789012345"
}
```

- **Nobody is notified.** Share `paymentUrl` in a message or an email, or draw it as a QR code.
  Opening it on a phone opens the TxGold app on this request.
- **The amount can't be changed.** The link carries the amount and memo for display only. The
  app looks the request up and shows the payer what you stored, and the payment must be for
  exactly that amount, so editing the link changes nothing.
- **It's paid once.** The first payment marks it `paid`, and `payerAccountId` becomes the account
  that paid. A second attempt is refused, with [`request_not_pending`](/errors/request_not_pending)
  through the API, or [`payment_request_already_paid`](/errors/payment_request_already_paid) in
  the app.
- **It always expires:** 30 days unless you say otherwise, and at most 90. Cancel it as soon as
  it's no longer wanted, such as an abandoned sale at a till.

The examples draw the QR for you; see [Ways to get paid](/guides/ways-to-get-paid#examples).

## Statuses

| Status | Meaning |
|---|---|
| `pending` | Waiting for the payer |
| `paid` | Paid: `paymentId` is the payment, `statusChangedAt` when |
| `dismissed` | The payer dismissed it in the app |
| `cancelled` | You cancelled it |
| `expired` | Passed `expiresAt` unpaid |

A cancelled or expired request can't be paid: the payer's attempt is refused with
[`payment_request_not_payable`](/errors/payment_request_not_payable).

## Watch for payment

Until webhooks arrive, poll the request, or list your pending ones:

```http
GET /v1/payment-requests/{id}
GET /v1/payment-requests?accountId=1000007&status=pending&limit=50
```

Lists are newest first and paged with `cursor` (see [Conventions](/guides/conventions#lists)).
A reasonable poll is every few seconds while a customer is paying, and every few minutes for
invoices.

## Cancel a request

```http
POST /v1/payment-requests/{id}/cancel
```

It leaves the payer's app at once, and an open request's link stops taking payments. Only a
pending request can be cancelled ([`request_not_pending`](/errors/request_not_pending)).

## In the Sandbox

Requests can be paid on demand with
[`POST /v1/sandbox/payment-requests/{id}/pay`](/sandbox#simulating-a-customer-paying): by the demo
customer they're addressed to, or for an open request by the demo customer you name.
