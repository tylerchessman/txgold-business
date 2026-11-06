# Idempotency and retries

A network call can fail after TxGold has already acted, so a payment you think failed may have
gone through. The API is built so a retry can never pay twice.

## The timestamp is the idempotency key

Every request is signed with a `TxG-Timestamp`. For a create call (a payment, a payment request or
a refund), that timestamp identifies the request:

| You resend | TxGold answers |
|---|---|
| The **identical** signed request: same timestamp, same body | **200** with the original result, and nothing new happens |
| The same timestamp with a **different** body | **409** [`duplicate_request`](/errors/duplicate_request) |
| A new timestamp | A new request: a second payment |

So to retry safely, **resend exactly what you sent**, headers included. Don't re-sign it with a new
timestamp.

## In the SDKs

Two ways, and both resend the same signed bytes:

- **Automatic:** set `maxRetries` (`max_retries` in Python, `MaxRetries` in C#). After a network
  error or a 502, 503 or 504, the SDK waits (0.5 s, 1 s, 2 s, … up to 8 s) and resends the
  identical request. It's off by default.
- **Your own:** pass the `timestamp` from the first attempt to the create call:

```js
import { ticksNow } from '@txgold/business';

const timestamp = ticksNow().toString();          // keep this with your order
await client.payments.create(payment, { timestamp });
// …after a crash, the same call with the same timestamp and body is safe
```

The SDKs never reuse a timestamp for two different requests on their own.

## The window

A timestamp is accepted for about **7 minutes** (and up to 3 minutes early, for clock skew). A retry
after that is refused with [`timestamp_out_of_range`](/errors/timestamp_out_of_range). Then find
out what happened instead of retrying blind:

- look for the payment in [your transactions](/guides/accounts#list-transactions), matching on
  `memoInternal` (put your own order id there), or
- for a payment request, list your requests.

## What else is safe to retry

Reads (`GET`) are always safe. Cancelling a request twice gives
[`request_not_pending`](/errors/request_not_pending) the second time, which you can treat as done.
