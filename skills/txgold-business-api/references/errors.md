# TxGold error codes

Every error is `application/problem+json`: `type`, `title`, `status`, `code`, `detail`, `requestId`,
and for `invalid_request` an `errors` map of field to problems. Branch on `code`; log `requestId`.
Codes marked *portal* come from the business portal's routes, which integrations don't call.

Generated from `docs/errors/errors.json`; each code has a page at `https://docs.txgold.money/errors/<code>`.

## 400

| Code | Meaning | What to do |
|---|---|---|
| `invalid_request` | The request is malformed: the JSON doesn't parse, a field is missing, unknown or of the wrong type, an amount has more than 2 decimal places, or a memo is over 150 characters. A misspelt field is an error, not an omitted one. | Read `errors` in the response: it maps each bad field to its problems. Fix the request and send it again with a new timestamp. |

## 401

| Code | Meaning | What to do |
|---|---|---|
| `invalid_signature` | The TxG-Key-Id, TxG-Timestamp or TxG-Signature header is missing, or the signature doesn't match the request as TxGold received it. | If you sign by hand, compare your canonical string with the one in `detail`: TxGold puts the string it verified there. The usual causes are signing a different body than the one sent (re-serializing the JSON after signing), changing the query string's encoding, or a proxy that rewrites the request. The SDKs sign exactly the bytes they send. |
| `key_expired` | The key passed the expiry date set when it was added, or an Admin revoked it in the business portal. | Add a new key to the integration in the business portal and switch to it. Add the new one before the old one expires to rotate without downtime. |
| `key_not_found` | TxGold doesn't know the key in TxG-Key-Id, or it belongs to the other environment (Sandbox and Production keys are separate). | Check that you're using the key file for this environment, and that the key is still listed for the integration in the business portal. |
| `session_expired` *(portal)* | Returned to the business portal when the sign-in has expired, was signed out, or was declined on the phone. Integrations never see it. | Sign in to the portal again. |
| `session_not_found` *(portal)* | Returned to the business portal when the browser's key has no sign-in. Integrations never see it. | Sign in to the portal again. |
| `sign_in_pending` *(portal)* | Returned to the business portal while a sign-in waits for approval on the phone. Integrations never see it. | Approve the sign-in in the TxGold app. |
| `timestamp_out_of_range` | TxG-Timestamp is too far from TxGold's clock: more than 3 minutes ahead, or more than 7 minutes behind. | Check the server's clock (NTP). A retry of an old request can't be resent once it's out of the window: look the payment up instead, as in [Idempotency and retries](https://docs.txgold.money/guides/idempotency). |

## 403

| Code | Meaning | What to do |
|---|---|---|
| `forbidden` | The key is valid but its role may not do this: a Device key sending a payment, a no-refunds role refunding, or a key acting on a TxGold system account. | Use an integration with the Integration role for back-office work. An Admin can change an integration's role in the business portal. |

## 404

| Code | Meaning | What to do |
|---|---|---|
| `not_found` | The account, payment or payment request doesn't exist, or your key isn't attached to it. The two cases get the same answer on purpose, so ids can't be probed. | Check the id, and that the key belongs to an integration on the account involved. |

## 409

| Code | Meaning | What to do |
|---|---|---|
| `already_refunded` | The payment already has a refund. A payment can be refunded once, in full or in part. | Fetch the payment to see its `refundId` and `refundedAmount`. To return more, send a new payment to the customer. |
| `duplicate_request` | The timestamp was already used for a different request from this account. Each TxG-Timestamp is also the request's idempotency key. | Sign a new request with a new timestamp. To resend the same payment safely, resend the identical request: same timestamp and same body. See [Idempotency and retries](https://docs.txgold.money/guides/idempotency). |
| `hold_expired` | The hold reached its `heldUntil` before you captured it, so the money is the customer's again. | Capture before `heldUntil`. To charge now, ask for a new hold or a payment request. |
| `hold_not_held` | Capture needs a hold in `held`. This one is still `pending` (the customer hasn't approved it), or already captured, released, declined or cancelled. | GET the hold and act on its `status`. A hold can be captured once; wait for `held` (the `hold.held` webhook, or poll) before capturing. |
| `hold_not_open` | Release needs a pending or held hold. This one is already captured, released, declined, cancelled or expired. | Nothing to do: the customer's money is already free. Treat as done. |
| `key_already_registered` *(portal)* | Returned to the business portal when the public key being added is already in use. | Generate a new key pair for each key you add. |
| `not_pending` | Returned to the business portal and the phone app when a sign-in or approval was already decided or has expired. | Start the sign-in or change again. |
| `payment_request_already_paid` | Someone has already paid this open payment request. An open request (one made with no payer) can be paid once, by whoever pays first; a second payment is refused and nothing moves. Through the API a second attempt is normally refused earlier, with `request_not_pending`. This code is what a payment gets when it reaches the ledger anyway: two payers in the same instant, or a payer in the TxGold app. | Fetch the request: it's `paid`, and `paymentId` is the payment that paid it. If this customer still owes you, create a new request for them. |
| `request_not_pending` | The payment request was already paid, dismissed, cancelled or has expired, so it can't be paid or cancelled. An open request stops being pending as soon as anyone pays it. | Fetch the request to see its `status`. Create a new request if the customer still needs to pay. |
| `webhook_endpoint_disabled` *(portal)* | The endpoint was disabled after failing every delivery for 3 days, or by an Admin. | Fix the receiver, then re-enable the endpoint in the business portal. |

## 413

| Code | Meaning | What to do |
|---|---|---|
| `payload_too_large` | The request body is over 64 KB. No API request needs more. | Check that you're sending only the documented fields. |

## 422

| Code | Meaning | What to do |
|---|---|---|
| `amount_below_minimum` | Payments to a business or charity, and payment requests from one, must be more than 0.02 TxGold. | Send a larger amount. |
| `amount_must_match_request` | A payment that names a `paymentRequestId` must be for exactly the requested amount. | Use the request's `amount`. |
| `approval_required` *(portal)* | Returned to the business portal when a change, such as raising an integration's role, needs an Admin's approval on the phone. | Ask for approval in the portal, then approve it in the TxGold app. |
| `business_rule_violation` | A TxGold rule refused the request. `detail` says which. | Read `detail`; contact TxGold support with the request id if it isn't clear. |
| `capture_exceeds_hold` | The capture amount is more than the amount held. | Capture at most the hold's `amount`. For more, charge the rest separately (a payment request). |
| `daily_send_limit_exceeded` | The payment would take the paying account over its daily sending limit. | Try again tomorrow, or contact TxGold support about the account's limits. |
| `destination_account_invalid` | The account being paid doesn't exist or can't receive payments. | Look the business up by its handle with `GET /v1/accounts/lookup` before paying it, and check the id. |
| `identity_check_required` | The account must finish its identity check in the TxGold app before it can do this, such as sending refunds. | Complete the identity check in the TxGold app. |
| `insufficient_balance` | The paying account's balance doesn't cover the amount. | Check the balance with `GET /v1/accounts/{accountId}`. In the Sandbox, add test TxGold with the fund route. |
| `payer_account_invalid` | The account asked to pay doesn't exist or can't be asked to pay, or no account has the `payerHandle` you gave. | Check `payerAccountId`, or the handle: it must match an account's handle exactly (a leading @ is ignored). |
| `payer_not_demo_customer` | Sandbox only: `simulate pay` works only for requests sent to one of your business's demo customers, and for open requests paid by one. | Create the request for one of the demo customers you were given with your Sandbox business. For an open request, name one of them as `payerAccountId`, or leave it out to use the first. |
| `payment_request_not_payable` | The payment request was cancelled by the business, or passed its `expiresAt`. | Ask the business for a new request. |
| `recipient_balance_limit_exceeded` | The payment would take the recipient over the balance their verification tier allows. | Send a smaller amount. The recipient can raise their limit by completing more verification in the app. |
| `refund_exceeds_original` | The refund amount is more than the payment received. | Refund at most the payment's `amount`, or leave `amount` out to refund all of it. |
| `same_account` | The payment's source and destination are the same account. | Check `destinationAccountId`. |
| `source_account_inactive` | The paying account isn't active. | Contact TxGold support with the request id. |
| `webhook_endpoint_limit` *(portal)* | The business already has the most webhook endpoints allowed. | Remove an endpoint you no longer use, or subscribe one endpoint to more events. |

## 429

| Code | Meaning | What to do |
|---|---|---|
| `rate_limited` | Too many requests in a short time from this key: account lookup allows 60 a minute per key. | Wait and retry with a backoff. Look a customer's handle up once and store the account id. |

## 500

| Code | Meaning | What to do |
|---|---|---|
| `internal_error` | Something failed on TxGold's side. No detail is given, by design. | Retry later. For a payment, resend the identical request (same timestamp) so it can't be paid twice. Contact TxGold support with the request id if it keeps happening. |

## 503

| Code | Meaning | What to do |
|---|---|---|
| `rate_unavailable` | TxGold has no gold price to quote right now. | Retry in a few minutes. |
| `sandbox_unavailable` | Sandbox only: the Sandbox can't create test TxGold at the moment. | Retry later, or contact TxGold support. |
| `webhooks_unavailable` *(portal)* | TxGold can't manage or send webhooks at the moment. | Retry later; deliveries already queued are kept and retried. |
