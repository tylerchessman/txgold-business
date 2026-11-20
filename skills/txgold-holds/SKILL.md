---
name: txgold-holds
description: Build "hold, then charge what was used" flows on the TxGold Business API - pay at the pump, EV charging, rentals, deposits, bar tabs, pre-authorizations. Use this skill whenever code creates, approves, waits on, captures (charges) or releases TxGold holds (POST /v1/holds, /v1/holds/{id}/capture, /v1/holds/{id}/release, GET /v1/holds), shows a hold request's holdUrl as a QR code, simulates approval in the Sandbox, or tests holds end to end against a real customer's phone - even if the user says "pre-auth", "authorize then capture", "reserve funds" or "pump" rather than "hold". Read the txgold-business-api skill too for client setup, signing and errors.
---

# TxGold holds: approve first, charge what was used

A **hold** sets aside part of a customer's TxGold balance, with their approval, so you can charge
the real amount later: hold 150.00 before the pump starts, charge 63.17 for the fuel, and the rest
goes straight back. Typical uses: fuel and EV charging, rentals, deposits, tabs.

For the client, signing, errors and the Sandbox, see the `txgold-business-api` skill. The SDKs
(0.2.x) have no hold methods yet: use the generic signed call, `client.request(...)` (JS, Python)
or `client.SendAsync<T>(...)` (C#).

## The flow

```
POST /v1/holds ──► pending ──(customer approves in the app)──► held ──► POST …/capture ──► captured
                     │  └─(declines)──► declined                │                      (rest released)
                     │  └─(approveBy passes)──► expired         ├─► POST …/release ──► released
                     └─ POST …/release ──► cancelled             └─(heldUntil passes)──► expired
```

1. **Ask.** `POST /v1/holds` with the amount and who should approve. Nothing is reserved yet.
2. **The customer approves** in the TxGold app, on their phone: from a push notification (a named
   customer) or by opening the request's `holdUrl` (an open request, e.g. a QR on the pump). They
   see your name, the amount, the memo and how long it's held, and that once approved they can't
   cancel it. Approving sets the amount aside; their balance shows it as held.
3. **Wait for `held`.** Take the `hold.held` webhook (see `txgold-webhooks`) or poll
   `GET /v1/holds/{id}`. Only start the pump / unlock the car once it's `held`.
4. **Charge what was used**, once: `POST /v1/holds/{id}/capture` with an amount from 0.01 up to the
   amount held. The rest is released at once, and the customer gets a receipt in the app.
   Charging nothing? **Release** it instead: `POST /v1/holds/{id}/release`.
5. If you do neither before `heldUntil`, the hold **expires** and the money is the customer's again.

## Asking for a hold

```http
POST /v1/holds
{ "accountId": "1000007", "payerHandle": "Jason-Miles", "amount": "150.00",
  "memo": "Pump 4, Main St", "memoInternal": "order-8812", "tag": "pump-4",
  "holdMinutes": 30 }
```

| Field | |
|---|---|
| `accountId` | Your business account; the key must be attached to it |
| `payerAccountId` *or* `payerHandle` | The customer, who gets a push. Prefer a stored account id: look the handle up once with `GET /v1/accounts/lookup` and keep the id. **Give neither** for an *open* request (below) |
| `amount` | The most you will charge, decimal string, 2 places |
| `memo` | Shown to the customer, and becomes the charge's memo (150 chars) |
| `memoInternal` | Yours only: put your order id here (150 chars) |
| `tag` | Yours only, e.g. the pump or device (50 chars); `GET /v1/holds?tag=` filters on it |
| `approveBy` | ISO 8601; when the request stops being approvable. Default 10 minutes from now, at most 24 hours |
| `holdMinutes` | How long the hold lasts **once approved**: 1 to 4320 (3 days), default 60. Capture or release before then |

Answers **201** with the hold (`status: "pending"`), or **200** with the existing one when you
resend the identical signed request (same `TxG-Timestamp`): retries are safe.

Errors: `invalid_request`, `same_account`, `amount_below_minimum`, `payer_account_invalid` (no such
active customer), plus the usual signing errors. `not_found` usually means the key isn't attached
to `accountId`.

### Open hold requests (a QR code on the pump)

With no payer, the hold is **open**: nobody is notified, the hold has `isOpen: true` and a
`holdUrl` (`https://app.txgold.money/ApproveHold?AccountId=…&Request=…`) while pending. Draw it
as a QR code on the pump's screen, or hand it to the customer from your own app; the first person
to approve it becomes the payer (`payerAccountId` is filled in then). Keep `approveBy` short (a
few minutes) for a pump, and release (cancel) a pending one when the customer walks away.

The link only identifies the request; the app shows what TxGold stored, so editing a link changes
nothing. Show the QR only for a pending hold.

## Waiting for approval

Approval happens on a person's phone, so it takes seconds to minutes, or never. Design for that:

- **Webhooks first:** subscribe to `hold.held`, `hold.declined`, `hold.expired`. TxGold sends
  `hold.held` within a few seconds of the approval.
- **Poll as a fallback:** `GET /v1/holds/{id}` every 2-5 seconds while `pending`, and **stop at
  `approveBy`** (plus a few seconds). Act on `status`:

| `status` | Do |
|---|---|
| `pending` | Keep waiting (until `approveBy`) |
| `held` | Start the service. Note `heldUntil`: capture or release before it |
| `declined` | The customer said no. Stop |
| `expired` | Not approved in time, or held and never charged. Stop |
| `cancelled` | You released it while pending |
| `captured` / `released` | Already finished |

New statuses may be added: treat an unknown one as "not held".

## Charging (capture) and releasing

```http
POST /v1/holds/{id}/capture
{ "amount": "63.17", "memo": "Pump 4: 41.2 L" }      → 201 { "hold": {…captured…}, "payment": {…} }
```

- **Once only**, and only while `held`. `amount` > 0 and ≤ the held amount. `memo` defaults to the
  hold's memo.
- The response has the updated hold (`amountCaptured`, `amountReleased`, `paymentId`) and the
  payment (`holdId` set). The customer pays the amount you captured; TxGold's fee comes out of
  what you receive, as with any payment.
- Resending the identical signed request answers 200 with the same result.
- Errors: `hold_not_held` (409: still pending, or already finished), `hold_expired` (409: past
  `heldUntil`), `capture_exceeds_hold` (422).
- **Only the Integration role** (or an Admin/Manager) may capture; Device keys can ask for and
  release holds but not charge them.

```http
POST /v1/holds/{id}/release                           → 200 hold (released, or cancelled if it was pending)
```

`hold_not_open` (409) means it already finished: treat as done.

## Listing

`GET /v1/holds?accountId=…&status=held&tag=pump-4&limit=50&cursor=…`: newest first, paged. Useful
for a pump controller restarting: find its `held` holds and capture or release each.

## Sandbox: approve without a phone

`POST /v1/sandbox/holds/{id}/approve` has a demo customer approve a pending hold exactly as in the
app (the demo customer is funded first if short). For an open request, pass
`{ "payerAccountId": "<a demo customer>" }` or leave it out for your first demo customer. Answers
the hold, now `held`. Sandbox `holdUrl`s open the real app, which can't see Sandbox holds, so
approve them with this route instead.

## A complete flow (JavaScript)

```js
import { TxGoldClient, TxGoldApiError } from '@txgold/business';

const client = new TxGoldClient({ key: process.env.TXGOLD_KEY_FILE, maxRetries: 2 });
const accountId = process.env.TXGOLD_ACCOUNT_ID;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForApproval(holdId, approveBy) {
  const deadline = new Date(approveBy).getTime() + 10_000;
  for (;;) {
    const hold = await client.request('GET', `/v1/holds/${encodeURIComponent(holdId)}`);
    if (hold.status !== 'pending' || Date.now() > deadline) return hold;
    await sleep(3000);
  }
}

const hold = await client.request('POST', '/v1/holds', undefined, {
  accountId, payerHandle: 'Jason-Miles', amount: '150.00', memo: 'Pump 4', tag: 'pump-4', holdMinutes: 30,
});
console.log('Asked for hold', hold.id, '- approve it in the TxGold app before', hold.approveBy);

const decided = await waitForApproval(hold.id, hold.approveBy);
if (decided.status !== 'held') {
  if (decided.status === 'pending') await client.request('POST', `/v1/holds/${hold.id}/release`); // give up: cancel it
  throw new Error(`Hold ${hold.id} ended ${decided.status}`);
}

// … pump fuel …
const { hold: done, payment } = await client.request('POST', `/v1/holds/${hold.id}/capture`, undefined, { amount: '63.17' });
console.log(done.status, 'charged', done.amountCaptured, 'released', done.amountReleased, 'payment', payment.id);
```

Python is the same shape: `client.request("POST", "/v1/holds", body={...})`,
`client.request("GET", f"/v1/holds/{hold_id}")`. C#:
`await client.SendAsync<JsonElement>(HttpMethod.Post, $"/v1/holds/{id}/capture", body: new { amount = "63.17" })`.

## Testing against a real phone

Outside the Sandbox a real person approves on their phone, so a test script is interactive:

- The approver needs the TxGold app signed in to the account you name, with **enough available
  balance**, and their **daily send limit** must allow the amount (an approved hold counts against
  it, like a payment). Use small amounts.
- Print the hold id, amount and `approveBy` and tell the tester to approve it (push, or Home →
  Holds in the app; for an open request, print `holdUrl` or show it as a QR code). Poll until
  `approveBy`.
- Give the tester time: an `approveBy` of 10-15 minutes rather than the default 10.
- Check the outcomes they should see: after approval, the app shows the amount as held and
  "Available balance" drops; after capture, a receipt, and the unused part back in their balance.
- Exercise the paths separately: approve then capture part; approve then release; decline;
  let one expire; capture more than held (`capture_exceeds_hold`); capture twice (`hold_not_held`).
- Log every id and `requestId`, so a failure can be traced.

## Mistakes to avoid

- Starting the service on `pending`: only `held` means the money is set aside.
- Capturing more than once, or after `heldUntil`: plan one capture per hold.
- Polling forever: stop at `approveBy`, and release the request if you give up.
- Using a handle every time: look it up once and store the account id.
- Floats for money: amounts are strings with 2 places.
