# Payments and refunds

## Send a payment

```http
POST /v1/payments
{
  "accountId": "1000007",
  "destinationAccountId": "1000006",
  "amount": "0.50",
  "memo": "Payout",
  "memoInternal": "batch-17"
}
```

| Field | |
|---|---|
| `accountId` | The account paying. Your key must act for it, with the **Integration** role. |
| `destinationAccountId` | Who's paid. Required unless you give `paymentRequestId`. To pay a business by its handle, [look it up](/guides/accounts#look-up-a-business) first. |
| `amount` | A decimal string, at most 2 places. Payments to a business or charity must be more than 0.02. |
| `memo` | Shown to both sides. Up to 150 characters. |
| `memoInternal` | Your own reference (an order number, say), shown only to your side. Up to 150 characters. |
| `paymentRequestId` | Pays that request instead. See below. |

The answer is **201** with the payment, from your side:

```json
{
  "id": "29",
  "accountId": "1000007",
  "destinationAccountId": "1000006",
  "direction": "debit",
  "amount": "0.50",
  "fee": null,
  "memo": "Payout",
  "memoInternal": "batch-17",
  "createdAt": "2026-10-30T20:32:39.988Z",
  "paymentRequestId": null,
  "refundOf": null,
  "refundId": null,
  "refundedAmount": null,
  "balanceAfter": "4.46"
}
```

- `direction` is `debit` from the payer's side and `credit` from the payee's.
- `fee` is TxGold's fee, which the **recipient** pays. It's shown only to the recipient.
- `balanceAfter` is your balance after the payment. It appears only in the response that created
  the payment.

The recipient gets the TxGold app's usual "payment received" notification.

Resend the identical request (same `TxG-Timestamp`) and you get **200** with the original payment,
not a second one. See [Idempotency and retries](/guides/idempotency).

## Pay a payment request

When another account has asked you to pay, pass its id instead of a destination:

```http
POST /v1/payments
{ "accountId": "1000007", "paymentRequestId": "918", "amount": "12.50" }
```

The request must be addressed to `accountId` and still pending
([`request_not_pending`](/errors/request_not_pending) otherwise), and the amount must match it
exactly ([`amount_must_match_request`](/errors/amount_must_match_request)). The payment goes to the
requester, and the request is marked paid.

## Get a payment

```http
GET /v1/payments/{id}?accountId=1000007
```

`accountId` says which side you're looking from: the payer or the payee. You see `memoInternal`
only from your own side, and `fee` only as the recipient.

## Refund a payment you received

```http
POST /v1/payments/{id}/refunds
{ "amount": "0.20", "memo": "Returned item" }
```

Leave out `amount` (or send `{}`) to refund the whole payment. The answer is the refund, a new
payment back to the customer, with `refundOf` set to the original. The original then shows
`refundId` and `refundedAmount`.

- **One refund per payment**, in full or in part. A second one is
  [`already_refunded`](/errors/already_refunded). To return more, send the customer a payment.
- A refund can't itself be refunded, and can't be larger than the payment
  ([`refund_exceeds_original`](/errors/refund_exceeds_original)).
- **TxGold's fee isn't returned**: the recipient paid it on the original payment.
- The Integration and Device roles can refund; Device-no-refunds can't.

## Rules worth knowing

- Amounts are TxGold, as decimal strings with at most 2 places. A third place is refused, never
  rounded.
- The paying account needs the balance ([`insufficient_balance`](/errors/insufficient_balance)) and
  room in its daily sending limit ([`daily_send_limit_exceeded`](/errors/daily_send_limit_exceeded)).
- The recipient's verification tier caps the balance they can hold
  ([`recipient_balance_limit_exceeded`](/errors/recipient_balance_limit_exceeded)).
