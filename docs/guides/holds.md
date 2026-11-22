# Holds

A hold sets aside part of a customer's TxGold balance, with their approval, so you can charge the
real amount later. Hold 150.00 before the pump starts, charge 63.17 for the fuel, and the rest
goes straight back to the customer.

Use a hold when you don't know the final amount until the service is done: fuel and EV charging,
rentals, deposits, a bar tab. When you know the amount up front, a
[payment request](/guides/payment-requests) is simpler.

## How it works

1. **You ask.** `POST /v1/holds` with the most you might charge. Nothing is reserved yet.
2. **The customer approves** in the TxGold app on their phone. They see your name, the amount, the
   memo and how long the hold lasts, and that once approved they can't cancel it. Approving sets
   the amount aside: their balance shows it as held.
3. **You wait for `held`.** Only then start the pump or unlock the car.
4. **You charge what was used, once:** `POST /v1/holds/{id}/capture`. The rest goes back to the
   customer at once, and they get a receipt in the app. To charge nothing, release the hold
   instead.
5. **If you do neither** before the hold ends (`heldUntil`), it expires and the money is the
   customer's again.

```
POST /v1/holds ──► pending ──(customer approves)──► held ──► capture ──► captured
                      │                               │
                      ├─(customer declines)──► declined ├─► release ──► released
                      ├─(approveBy passes)───► expired  └─(heldUntil passes)──► expired
                      └─► release ───────────► cancelled
```

## Ask for a hold

```http
POST /v1/holds
{
  "accountId": "1000007",
  "payerHandle": "Jason-Miles",
  "amount": "150.00",
  "memo": "Pump 4, Main St",
  "memoInternal": "order-8812",
  "tag": "pump-4",
  "holdMinutes": 30
}
```

| Field | |
|---|---|
| `accountId` | Your account, which will charge the hold. |
| `payerAccountId` | The customer, by account id. They get a push notification. Optional: see below. |
| `payerHandle` | The customer by TxGold handle, instead of `payerAccountId`. A leading `@` is ignored. |
| `amount` | The most you will charge: a decimal string, at most 2 places, more than 0.02. |
| `memo` | Shown to the customer when they approve, and becomes the charge's memo. Up to 150 characters. |
| `memoInternal` | Your own reference, never shown to the customer. Up to 150 characters. |
| `tag` | Your own label: a pump, a till, a device. Never shown to the customer. Up to 50 characters. `GET /v1/holds?tag=` filters on it. |
| `approveBy` | Optional. When the request stops being approvable. Default 10 minutes from now, at most 24 hours. |
| `holdMinutes` | Optional. How long the hold lasts once approved: 1 to 4320 (3 days), default 60. Capture or release before then. |

Give `payerAccountId`, or `payerHandle`, or neither for an [open hold](#open-holds). Both together is
[`invalid_request`](/errors/invalid_request). A customer you'll see again: look their handle up
once with [`GET /v1/accounts/lookup`](/guides/accounts) and keep the account id.

The answer is **201** with the hold:

```json
{
  "id": "4471",
  "status": "pending",
  "accountId": "1000007",
  "payerAccountId": "1000006",
  "isOpen": false,
  "amount": "150.00",
  "memo": "Pump 4, Main St",
  "memoInternal": "order-8812",
  "tag": "pump-4",
  "holdMinutes": 30,
  "createdAt": "2026-11-22T16:10:00.000Z",
  "approveBy": "2026-11-22T16:20:00.000Z",
  "heldAt": null,
  "heldUntil": null,
  "amountCaptured": null,
  "amountReleased": null,
  "paymentId": null,
  "endedAt": null,
  "holdUrl": null
}
```

Resending the identical signed request returns the same hold with **200**, so retries are safe
(see [Idempotency](/guides/idempotency)). Errors: [`same_account`](/errors/same_account),
[`amount_below_minimum`](/errors/amount_below_minimum),
[`payer_account_invalid`](/errors/payer_account_invalid) (no such active customer).

The Integration and Device roles can use holds; Device-no-refunds can't.

## Wait for the customer

Approval happens on a person's phone: seconds, minutes, or never. Poll the hold:

```http
GET /v1/holds/{id}
```

every 1 to 2 seconds while it's `pending`, and **stop at `approveBy`** (plus a few seconds). Then
act on `status`:

| `status` | What to do |
|---|---|
| `pending` | Keep waiting, until `approveBy` |
| `held` | Start the service. Capture or release before `heldUntil` |
| `declined` | The customer said no. Stop |
| `expired` | Not approved in time, or held and never charged. Stop |
| `cancelled` | You released it while it was pending |
| `captured`, `released` | Already finished |

New statuses may be added: treat one you don't know as "not held". To give up on a pending
request (the customer walked away), release it: it becomes `cancelled` and leaves their phone.

## Charge what was used

```http
POST /v1/holds/{id}/capture
{ "amount": "63.17", "memo": "Pump 4: 41.2 L" }
```

`amount` is more than 0 and at most the amount held; `memo` is optional and defaults to the hold's.
The answer is **201** with the captured hold and the [payment](/guides/payments) that charged it:

```json
{
  "hold": { "id": "4471", "status": "captured", "amountCaptured": "63.17", "amountReleased": "86.83", "paymentId": "9120", "...": "..." },
  "payment": { "id": "9120", "amount": "63.17", "fee": "0.63", "...": "..." }
}
```

A hold is charged **once**. Resending the identical signed request returns the same capture with
200; any other second capture is [`hold_not_held`](/errors/hold_not_held). Errors:

- [`hold_not_held`](/errors/hold_not_held): still pending, or already captured, released, declined or cancelled.
- [`hold_expired`](/errors/hold_expired): `heldUntil` has passed. The money is the customer's again.
- [`capture_exceeds_hold`](/errors/capture_exceeds_hold): more than the amount held.

Fees are as for any payment received: see [Payments and refunds](/guides/payments).

## Release a hold

```http
POST /v1/holds/{id}/release
```

On a `held` hold it charges nothing: the customer's money is free at once, and the hold is
`released`. On a `pending` request it cancels it: the customer can no longer approve it, and it's
`cancelled`. Anything already finished is [`hold_not_open`](/errors/hold_not_open).

## Open holds

Leave out the payer and the hold is **open**: nobody is notified, and the hold has `isOpen: true`
and a `holdUrl` while it's pending:

```http
POST /v1/holds
{ "accountId": "1000007", "amount": "150.00", "memo": "Pump 4", "tag": "pump-4", "approveBy": "2026-11-22T16:13:00Z" }
```

```json
{ "id": "4472", "status": "pending", "isOpen": true, "payerAccountId": null,
  "holdUrl": "https://app.txgold.money/ApproveHold?AccountId=1000007&Request=638990000000000000", "...": "..." }
```

Draw `holdUrl` as a QR code on the pump's screen, or hand the customer off to it from your own
app. Opening it on a phone opens the TxGold app on the request. The first person to approve it
becomes the payer, and `payerAccountId` is filled in then.

- The link only identifies the request. The app shows what you stored, so editing the link
  changes nothing.
- Show the QR only while the hold is pending. Keep `approveBy` short for a pump (a few minutes),
  and release a pending one when the customer walks away.

## List holds

```http
GET /v1/holds?accountId=1000007&status=held&tag=pump-4&limit=50
```

Newest first, paged with `cursor` (see [Conventions](/guides/conventions#lists)). `status` and
`tag` are optional filters. Useful after a restart: find every `held` hold and capture or release
each one before its `heldUntil`.

## With an SDK

From SDK 0.3.0:

::: code-group

```js [JavaScript]
const hold = await client.holds.create({
  accountId, payerHandle: 'Jason-Miles', amount: '150.00', memo: 'Pump 4', tag: 'pump-4', holdMinutes: 30,
});

let current = hold;
const deadline = Date.parse(hold.approveBy) + 5_000;
while (current.status === 'pending' && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 2_000));
  current = await client.holds.get(hold.id);
}
if (current.status !== 'held') {
  if (current.status === 'pending') await client.holds.release(hold.id); // give up: cancel it
  throw new Error(`Hold ${hold.id} is ${current.status}`);
}

// ... pump the fuel ...
const { hold: done, payment } = await client.holds.capture(hold.id, { amount: '63.17' });
```

```python [Python]
hold = client.holds.create(account_id, "150.00", payer_handle="Jason-Miles", memo="Pump 4",
                           tag="pump-4", hold_minutes=30)

deadline = datetime.fromisoformat(hold["approveBy"].replace("Z", "+00:00")) + timedelta(seconds=5)
current = hold
while current["status"] == "pending" and datetime.now(timezone.utc) < deadline:
    time.sleep(2)
    current = client.holds.get(hold["id"])
if current["status"] != "held":
    if current["status"] == "pending":
        client.holds.release(hold["id"])  # give up: cancel it
    raise RuntimeError(f"Hold {hold['id']} is {current['status']}")

# ... pump the fuel ...
result = client.holds.capture(hold["id"], "63.17")  # amounts as str or Decimal, never float
```

```csharp [C#]
var hold = await client.Holds.CreateAsync(new HoldCreate
{
    AccountId = accountId, PayerHandle = "Jason-Miles", Amount = 150m, Memo = "Pump 4", Tag = "pump-4", HoldMinutes = 30,
});

var current = hold;
var deadline = hold.ApproveBy.AddSeconds(5);
while (current.Status == "pending" && DateTimeOffset.UtcNow < deadline)
{
    await Task.Delay(2000);
    current = await client.Holds.GetAsync(hold.Id);
}
if (current.Status != "held")
{
    if (current.Status == "pending") await client.Holds.ReleaseAsync(hold.Id); // give up: cancel it
    throw new InvalidOperationException($"Hold {hold.Id} is {current.Status}");
}

// ... pump the fuel ...
var result = await client.Holds.CaptureAsync(hold.Id, new HoldCapture { Amount = 63.17m });
```

:::

## In the Sandbox

Have a demo customer approve a pending hold:

```http
POST /v1/sandbox/holds/{id}/approve
```

The hold must be addressed to one of your demo customers. For an open hold, name which one
approves it with `{ "payerAccountId": "1000004" }`, or leave the body out for your first demo
customer. If the customer can't cover the amount they're topped up first, then they approve
exactly as in the app, and the hold is `held`. SDKs: `sandbox.approveHold` /
`sandbox.approve_hold` / `Sandbox.ApproveHoldAsync`. See [The Sandbox](/sandbox#simulating-a-customer-approving-a-hold).

Sandbox `holdUrl`s open the real TxGold app, which can't see Sandbox holds: show the QR to check
your screens, and approve with the route above.
