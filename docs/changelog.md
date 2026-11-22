# Changelog

Dated entries for the API and the SDKs. Additive changes (new fields, routes, error codes and enum
values) can arrive at any time; anything breaking waits for a new major version.

## Production opens

- **Production** at `https://api.txgold.money`, with real TxGold and real customers. Sign in to
  the [business portal](https://business.txgold.money) with the TxGold app on an Admin's phone,
  choose **Production**, and create an integration as you did in the Sandbox.
- The Sandbox moves to `https://api-sandbox.txgold.money`. The old Sandbox address keeps working
  for now, but use the new one.
- **SDKs 0.2.0** know both URLs and choose one from the key file's `environment`.
- **[Holds](/guides/holds)** (pay at the pump): `POST /v1/holds` asks a customer to approve a hold on their balance;
  once it is `held`, charge what was used, once, with `POST /v1/holds/{id}/capture`, or release it.
  Poll `GET /v1/holds/{id}` for the customer's answer. The Sandbox approves as a demo customer with
  `POST /v1/sandbox/holds/{id}/approve`.
- **SDKs 0.3.0** add `holds` (create, get, list, capture, release) and the Sandbox's hold approval.
- The OpenAPI document lists both servers.
- **A live demo** at [demo.txgold.money](https://demo.txgold.money): the six
  [ways to get paid](/guides/ways-to-get-paid), each from both sides, with every API call shown.
  Its code is the new `samples/demo-site`.
- **Agent Skills** for AI coding assistants (Claude Code, GitHub Copilot, Claude): they teach the
  assistant to write correct TxGold code. See [Build with an AI assistant](/ai-assistants).

## 2026-11-11

- **Open payment requests:** create a request with no payer and get a `paymentUrl` to share or
  draw as a QR code; anyone with it can pay it, once, for exactly the stored amount. New response
  fields `isOpen` and `paymentUrl`; `payerAccountId` is null until an open request is paid.
- **`payerHandle`:** ask a payer by their TxGold handle instead of their account id.
- **`tag`** on payment requests: your own label, never shown to the payer.
- New error [`payment_request_already_paid`](/errors/payment_request_already_paid) (409).
- Sandbox: `POST /v1/sandbox/payment-requests/{id}/pay` takes an optional `payerAccountId`, the
  demo customer who pays an open request.
- A new guide, [Ways to get paid](/guides/ways-to-get-paid), with five new examples in each
  language.
- **SDKs 0.2.0** with all of the above. The payer is now optional when creating a request;
  existing calls work unchanged.

## 2026-11-06

- **SDKs 0.1.0 (preview)** for JavaScript (`@txgold/business`), Python (`txgold-business`) and
  C# (`TxGold.Business`).
- The OpenAPI document describes amounts as decimal strings, as they've always been sent.
- These docs.

## 2026-11-04

- The **business portal**: phone-approved sign-in, integrations, keys with an expiry you choose.

## 2026-11-02

- The **Sandbox**, with test funding and simulated customer payments.

## 2026-10-30

- `v1`: payments, refunds, payment requests, accounts, transactions, lookup and rates, all signed
  with TXG1.
