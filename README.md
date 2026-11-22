# TxGold Business API: SDKs and samples

Send and request [TxGold](https://txgold.money) payments from your own systems. This repository has
the official client libraries for **JavaScript (Node.js)**, **Python** and **C# / .NET**, runnable
samples, the API's OpenAPI document, and the request-signing test vectors.

> **Preview (0.x).** The SDKs work against the **Sandbox** and **Production**. Until 1.0, minor
> versions may change the API of the SDKs.

Documentation: **https://docs.txgold.money**

## 1. Get a key

Sign in to the TxGold business portal with your phone, create an **integration**, and add a key. The
portal gives you a key file, `txgold-sandbox-<name>.key.json`. It holds your **private key**: keep it
out of source control and out of browsers, and treat it like a password. Anyone with the file can move
your business's money.

## 2. Install

| Language | Package | Needs |
|---|---|---|
| JavaScript | `npm install @txgold/business` | Node.js 18.17+ (server side only) |
| Python | `pip install txgold-business` | Python 3.9+ |
| C# / .NET | `dotnet add package TxGold.Business` | .NET 8+, or any netstandard2.1 runtime |

## 3. Make a payment

**JavaScript**

```js
import { TxGoldClient } from '@txgold/business';

const client = new TxGoldClient({ key: 'txgold-sandbox-mystore.key.json' });
const payment = await client.payments.create({
  accountId: '1000002', destinationAccountId: '1000004', amount: '12.50', memo: 'Order 1042',
});
```

**Python**

```python
from txgold_business import TxGoldClient

with TxGoldClient("txgold-sandbox-mystore.key.json") as client:
    payment = client.payments.create("1000002", "12.50", destination_account_id="1000004", memo="Order 1042")
```

**C#**

```csharp
using TxGold.Business;

using var client = new TxGoldClient("txgold-sandbox-mystore.key.json");
var payment = await client.Payments.CreateAsync(new PaymentCreate
{
    AccountId = "1000002", DestinationAccountId = "1000004", Amount = 12.50m, Memo = "Order 1042",
});
```

Each SDK has the same parts:

| | JavaScript | Python | C# |
|---|---|---|---|
| Payments | `payments.create / get / refund` | `payments.create / get / refund` | `Payments.CreateAsync / GetAsync / RefundAsync` |
| Payment requests | `paymentRequests.create / get / list / listAll / cancel` | `payment_requests.create / get / list / list_all / cancel` | `PaymentRequests.CreateAsync / …` |
| Accounts | `accounts.get / transactions / transactionsAll / lookup` | `accounts.get / transactions / transactions_all / lookup` | `Accounts.GetAsync / …` |
| Rates | `rates.get` | `rates.get` | `Rates.GetAsync` |
| Sandbox only | `sandbox.fund / payRequest` | `sandbox.fund / pay_request` | `Sandbox.FundAsync / PayRequestAsync` |

The [samples](https://github.com/tylerchessman/txgold-business/tree/main/samples) run a full tour in the Sandbox: rates, your balance, a payment, a payment
request that a demo customer pays, a refund, and your transactions.

## Things worth knowing

- **Amounts are decimal strings**, such as `"12.50"`, with at most 2 places: `string` in
  JavaScript, `str` or `Decimal` in Python, `decimal` in C#. Never floats.
- **Errors** are one exception type (`TxGoldApiError` / `TxGoldApiException`) with `status`, a
  stable `code` such as `insufficient_balance`, `detail` and a `requestId` for support. Every code
  is documented at `https://docs.txgold.money/errors/<code>`.
- **Idempotency:** a request's `TxG-Timestamp` is also its idempotency key. Resending the identical
  signed request returns the original payment instead of paying twice. Pass `timestamp` to a create
  call to resend deliberately; `maxRetries` resends automatically after a network error or a
  502/503/504, always with the same timestamp.
- **Signing** is done for you. To sign by hand in another language, see
  [Authentication](https://docs.txgold.money/authentication) and the test vectors in
  [`vectors/`](https://github.com/tylerchessman/txgold-business/tree/main/vectors), which every SDK here passes.

## Repository layout

```
openapi/      the API's OpenAPI 3 document (the Sandbox build)
vectors/      request-signing test vectors shared by every SDK
sdk/
  javascript/ @txgold/business      (TypeScript, no runtime dependencies)
  python/     txgold-business       (cryptography, httpx)
  csharp/     TxGold.Business       (no dependencies on .NET 8)
samples/      the tour, in each language
skills/       Agent Skills for AI coding assistants (Claude, GitHub Copilot)
```

## Building with an AI assistant

[`skills/`](skills) has [Agent Skills](https://agentskills.io) that teach Claude Code, Claude, GitHub
Copilot and similar tools to write correct TxGold integrations: signing, payments and holds.
In Claude Code: `claude plugin marketplace add tylerchessman/txgold-business`, then
`claude plugin install txgold-business@txgold`. For Copilot and others, see
[skills/README.md](skills/README.md).

## Running the tests

```bash
cd sdk/javascript && npm install && npm test
cd sdk/python && pip install -e ".[dev]" && pytest
cd sdk/csharp && dotnet test
```

## Reporting a security problem

Please don't open a public issue. Report it privately through GitHub: the repository's
**Security** tab, then **Report a vulnerability**.

## License

[MIT](LICENSE)
