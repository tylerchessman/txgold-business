# Payment requests

A payment request asks another TxGold account to pay yours. The payer gets a push notification
and a card on their TxGold home screen, and pays with a tap. You see the request turn `paid`.

## Create a request

```http
POST /v1/payment-requests
{
  "accountId": "1000007",
  "payerAccountId": "1000006",
  "amount": "12.50",
  "memo": "Invoice 4411",
  "memoInternal": "order-88231",
  "expiresAt": "2026-11-04T00:00:00Z"
}
```

| Field | |
|---|---|
| `accountId` | Your account, which will be paid. |
| `payerAccountId` | The account asked to pay. Required: a request is addressed to someone. |
| `amount` | A decimal string, at most 2 places. A business or charity must ask for more than 0.02. |
| `memo` | Shown to the payer, and becomes the payment's memo. Up to 150 characters. |
| `memoInternal` | Your own reference, never shown to the payer. Up to 150 characters. |
| `expiresAt` | Optional. At least 1 minute and at most 7 days ahead; 7 days if left out. |

The answer is **201**:

```json
{
  "id": "918",
  "status": "pending",
  "accountId": "1000007",
  "payerAccountId": "1000006",
  "amount": "12.50",
  "memo": "Invoice 4411",
  "memoInternal": "order-88231",
  "createdAt": "2026-10-30T16:10:00.000Z",
  "expiresAt": "2026-11-04T00:00:00.000Z",
  "statusChangedAt": null,
  "paymentId": null
}
```

Resending the identical signed request returns the same request with **200**.

The Integration and Device roles can create requests; Device-no-refunds can't.

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

It leaves the payer's app at once. Only a pending request can be cancelled
([`request_not_pending`](/errors/request_not_pending)).

## In the Sandbox

Requests to your demo customers can be paid on demand with
[`POST /v1/sandbox/payment-requests/{id}/pay`](/sandbox#simulating-a-customer-paying).
