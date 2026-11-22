---
name: txgold-business-api
description: Write code against the TxGold Business API (api.txgold.money, api-sandbox.txgold.money), the REST API businesses use to send and receive TxGold, a gold-backed digital currency. Use this skill whenever code calls TxGold - setting up a client from a TxGold .key.json key file, signing requests (TxG-Key-Id / TxG-Timestamp / TxG-Signature, TXG1-ECDSA-P256-SHA256), choosing Sandbox or Production, handling TxGold error codes, retrying safely, looking up accounts, handles or rates, or funding Sandbox test accounts. Also use it when the user mentions the @txgold/business, txgold-business or TxGold.Business SDKs, or says "TxGold" in a coding task, even in passing. For holds, payments and payment requests, and webhooks, use it together with the txgold-holds, txgold-payments and txgold-webhooks skills.
---

# TxGold Business API

TxGold is a digital currency backed by gold: one TxGold is a thousandth of a troy ounce. The
Business API lets a business's own systems send payments, ask customers to pay, hold an amount
before charging it (pay at the pump), and hear about what happened by webhook. Customers use the
TxGold phone app; your code never touches their keys.

This skill covers what every integration needs: a client, signing, conventions, errors, retries
and the Sandbox. The task-specific skills build on it:

| Task | Skill |
|---|---|
| Send payments, refunds, ask to be paid (payment requests, QR codes, checkout) | `txgold-payments` |
| Hold an amount, then charge what was used (fuel pumps, rentals, tabs) | `txgold-holds` |
| Receive and verify webhooks | `txgold-webhooks` |

Full docs: https://docs.txgold.money. The OpenAPI document: `https://api-sandbox.txgold.money/openapi/v1.json`.

## Before writing code, find out

1. **The key file.** An Admin creates an *integration* in the business portal
   (https://business.txgold.money) and adds a key; the portal downloads
   `txgold-<environment>-<name>.key.json`. It holds a **private key**: load it from a path or a
   secrets manager at run time. Never paste its contents into code, commit it, log it, or ship it
   in a browser or mobile app. If the user hasn't got one yet, write the code to take the path from
   an environment variable or argument and say how to get one.
2. **The business account id**, e.g. `"1000002"` (the key file's `accountId`).
3. **The environment.** `sandbox` (test money, demo customers) or `production` (real money). The
   key file's `environment` field decides it; the SDKs pick the base URL from it. For any other
   deployment TxGold gives you a base URL: pass it as `baseUrl` / `base_url` / `BaseUrl`.
4. **The language.** Use an SDK where there is one (JavaScript/TypeScript, Python, C#); sign by hand
   otherwise ([references/signing.md](references/signing.md)).

## Clients

```bash
npm install @txgold/business      # Node.js 18.17+, server side only
pip install txgold-business       # Python 3.9+
dotnet add package TxGold.Business # .NET 8+, or netstandard2.1
```

If the package can't be installed (not published to your registry yet, or an offline machine),
the SDK sources are in https://github.com/tylerchessman/txgold-business under `sdk/`, or sign by
hand with [references/signing.md](references/signing.md): it is a few dozen lines.

```js
import { TxGoldClient, TxGoldApiError } from '@txgold/business';
const client = new TxGoldClient({ key: process.env.TXGOLD_KEY_FILE, maxRetries: 2 });
// another deployment: new TxGoldClient({ key, baseUrl: 'https://…' })
const account = await client.accounts.get('1000002');
```

```python
from txgold_business import TxGoldClient, TxGoldApiError
with TxGoldClient(os.environ["TXGOLD_KEY_FILE"], max_retries=2) as client:  # base_url="https://…" for another deployment
    account = client.accounts.get("1000002")
```

```csharp
using TxGold.Business;
using var client = new TxGoldClient(new TxGoldClientOptions { KeyFile = keyPath, MaxRetries = 2 }); // BaseUrl = new Uri("https://…")
var account = await client.Accounts.GetAsync("1000002");
```

Wrapped resources: `payments`, `paymentRequests` / `payment_requests` / `PaymentRequests`,
`accounts`, `rates`, `sandbox`. Python returns plain dicts with the API's camelCase keys
(`account["balance"]`); C# returns typed models.

### Routes the SDK doesn't wrap yet

New routes (holds, for example) may reach the API before an SDK method exists. Every SDK has a
signed generic call; use it rather than hand-rolling HTTP:

```js
const hold = await client.request('POST', '/v1/holds', undefined, { accountId, payerHandle, amount: '25.00' });
const page = await client.request('GET', '/v1/holds', { accountId, status: 'held' });
```

```python
hold = client.request("POST", "/v1/holds", body={"accountId": account_id, "payerHandle": handle, "amount": "25.00"})
page = client.request("GET", "/v1/holds", {"accountId": account_id, "status": "held"})
```

```csharp
var hold = await client.SendAsync<JsonElement>(HttpMethod.Post, "/v1/holds",
    body: new { accountId, payerHandle, amount = "25.00" });
```

They sign, send, retry and raise the same error type as the wrapped methods, and take a
`timestamp` for idempotent retries (below).

## Conventions

- **Money is a decimal string** in TxGold with at most 2 places: `"12.50"`. Never use floats; use
  `Decimal` / `decimal` / strings, and format with exactly two places.
- **Ids are strings**, even when numeric. Don't do arithmetic on them or store them as numbers.
- **Times** are ISO 8601 UTC with `Z`.
- **JSON** is camelCase. **Unknown request fields are refused** (`invalid_request`), so a typo can't
  be silently dropped; unknown *response* fields and enum values can appear at any time, so ignore
  what you don't know rather than failing.
- **Lists** return `{ "data": [...], "nextCursor": "..." }`; pass `limit` (1-200) and `cursor`.
  `nextCursor` is null on the last page. Cursors are opaque.
- Bodies are at most 64 KB. Every response has an `X-Request-Id`.

## Errors

Every error is `application/problem+json` with a stable `code`; the SDKs raise one type with
`status`, `code`, `title`, `detail`, `requestId` and, for `invalid_request`, per-field `errors`.
**Branch on `code`**, never on `detail` (its wording changes). Log `requestId`.

```js
try { await client.payments.create(p); }
catch (e) { if (e instanceof TxGoldApiError && e.code === 'insufficient_balance') { /* … */ } else throw e; }
```

The ones integrations meet most:

| Code | Status | Meaning, and what to do |
|---|---|---|
| `invalid_signature` | 401 | `detail` holds the canonical string the server verified. Diff it with yours. |
| `timestamp_out_of_range` | 401 | Clock skew (allowed: 3 min ahead, 7 behind), or a retry too late. Fix NTP; don't blindly re-sign a create. |
| `key_not_found` / `key_expired` | 401 | Wrong environment for the key, revoked, or expired. |
| `forbidden` | 403 | The integration's role can't do this (Device roles can't send). |
| `not_found` | 404 | Also returned when the key isn't attached to the account you named. |
| `duplicate_request` | 409 | Same timestamp, different body. A bug: one timestamp per logical request. |
| `insufficient_balance`, `daily_send_limit_exceeded`, `recipient_balance_limit_exceeded` | 422 | Business rules; tell the user. |
| `rate_limited` | 429 | Back off (account lookup: 60 a minute per key). |

All 43 codes: [references/errors.md](references/errors.md).

## Retries and idempotency

The request's `TxG-Timestamp` (UTC in .NET ticks) is its **idempotency key**. Resending the
*identical* signed request (same timestamp, same bytes) returns the original result with 200 and
does nothing new; a new timestamp is a new request, i.e. a second payment.

- Turn on `maxRetries` / `max_retries` / `MaxRetries`: on a network error or 502/503/504 the SDK
  resends the identical request.
- To survive a crash, store the timestamp with your order before sending and pass it again:
  `ticksNow()` in JS, then `client.payments.create(p, { timestamp })`; the generic calls take
  `timestamp` too.
- A timestamp is accepted for about 7 minutes. After that, look the result up (list transactions,
  matching your own reference in `memoInternal`) instead of re-sending.
- GETs are always safe to retry.

## Roles

| | Integration | Device | Device, no refunds |
|---|---|---|---|
| Send payments, capture holds | yes | | |
| Refund | yes | yes | |
| Payment requests, holds | yes | yes | |
| See balances | yes | | |
| Read accounts, history, rates | yes | yes | yes |

## Accounts, handles and rates

- `GET /v1/accounts/{id}` (`accounts.get`): name, type, tier, active, and balance if the role may see it.
- `GET /v1/accounts/{id}/transactions`: history, paged; filter by date. `transactionsAll` walks pages.
- `GET /v1/accounts/lookup?accountName=Jason-Miles` (`accounts.lookup`): a handle to an account id.
  For a customer, look the handle up **once** and store the id: it survives a rename. Only exact
  matches on active accounts; personal accounts return just `id` and `type`.
- `GET /v1/rates`: `usdPerTxGold`, refreshed every half hour.

## The Sandbox

A separate TxGold with test money, at `https://api-sandbox.txgold.money`. Your Sandbox business
comes with **demo customers**: accounts that pay or approve on request, because the Sandbox has no
phones. Extra routes, Sandbox only:

| Route | SDK | Does |
|---|---|---|
| `GET /v1/sandbox/customers?accountId={id}` | generic `request` | Lists your demo customers: `data[]` of `id`, `accountName`, `displayName`, `balance` |
| `POST /v1/sandbox/accounts/{id}/fund` `{amount}` | `sandbox.fund(id, '50.00')` | Adds test TxGold (at most 1000.00 a call) |
| `POST /v1/sandbox/payment-requests/{id}/pay` | `sandbox.payRequest(id)` | A demo customer pays a request |
| `POST /v1/sandbox/holds/{id}/approve` | generic `request` | A demo customer approves a hold request |

**Finding the demo customers:** don't guess ids or handles. Call `GET /v1/sandbox/customers`
with the business's account id and use the ids it returns as `payerAccountId` /
`destinationAccountId`. The first one listed is the default payer of an open request or hold.
If that route isn't available, ask the developer for the demo customer ids that came with their
Sandbox business. Outside the Sandbox there are no demo customers: a real person approves on
their phone, so ask the developer which customer account to use.

Links and QR codes (`paymentUrl`, `holdUrl`) open the real TxGold app, which can't see Sandbox
requests: in the Sandbox, show them to check your screens, then simulate the customer with the
routes above. Everything else (signing, roles, limits, errors, fees) behaves as in production.

## Writing good TxGold code

- Load the key from a path or secret store; keep it server side.
- Make every create retry-safe: `maxRetries` on, and your own reference in `memoInternal`.
- Treat a customer's approval or payment as **asynchronous**: they act on their phone. Prefer
  webhooks; poll with a backoff and a deadline otherwise.
- Print or log the `requestId` of any error, and the ids of what you created.
- Signing by hand, or debugging `invalid_signature`: [references/signing.md](references/signing.md).
