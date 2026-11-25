# Accounts and history

## Get an account

```http
GET /v1/accounts/{accountId}
```

```json
{
  "id": "1000002",
  "accountName": "AcmeSandbox",
  "displayName": "Acme Sandbox",
  "type": "business",
  "tier": 1,
  "active": true,
  "balance": "59.19"
}
```

Your key must act for the account. `balance` is filled for the Integration role, and `null` for
Device roles.

## List transactions

```http
GET /v1/accounts/{accountId}/transactions?from=2026-11-01&to=2026-12-01&limit=50
```

Newest first, paged with `cursor`. `from` is inclusive and `to` exclusive; each is an ISO 8601 time
(with `Z` or an offset, and a `+` URL-encoded as `%2B`) or a date, meaning midnight UTC.

```json
{
  "data": [
    {
      "id": "15",
      "direction": "credit",
      "amount": "0.50",
      "fee": "0.01",
      "counterparty": {
        "accountId": "1000004",
        "accountName": "AcmeSandbox-Customer1",
        "displayName": "Demo Customer 1 (Acme Sandbox)",
        "type": "personal"
      },
      "memo": "Invoice 4411",
      "memoInternal": null,
      "createdAt": "2026-11-06T17:31:34.562Z",
      "paymentRequestId": "4",
      "paymentRequestTag": "spring-campaign",
      "refundOf": null,
      "refundId": "17",
      "balanceAfter": "59.69",
      "estimatedUsdValue": "2.20",
      "actualUsdValue": null
    }
  ],
  "nextCursor": "NjM5Mjk1ODMwOTQ0MDIwMjE4LjE0"
}
```

- `amount` is always positive; `direction` says which way it went.
- `fee` is on credits only: TxGold's fee, which you paid as the recipient. `balanceAfter` is after
  it.
- `paymentRequestId`, `refundOf` and `refundId` link the row to its request and refunds.
- `memo` is the payer's memo. `memoInternal` is your own reference: on a debit, the one you gave
  the payment; on a credit that paid one of your payment requests, that request's `memoInternal`.
  For a [pay widget](/guides/pay-widget), that's the details the visitor typed. The device roles
  get `null` for it on credits.
- `paymentRequestTag` is the paid request's `tag`: for a pay widget, the widget's id.
- `estimatedUsdValue` is what the TxGold was worth in dollars at the time. `actualUsdValue` is set
  only where dollars really changed hands.
- `balanceAfter` is filled for the Integration role only.

## Look up a business

To pay a business or charity by its handle, resolve the handle first:

```http
GET /v1/accounts/lookup?accountName=PoolMan
```

```json
{ "id": "1000007", "accountName": "PoolMan", "displayName": "The Pool Man", "type": "business" }
```

The match is exact (the `@` is optional), and only active business and charity accounts are
found. Personal accounts can't be searched, by design.
