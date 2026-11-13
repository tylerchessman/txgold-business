# Quickstart

From nothing to a payment in the Sandbox in about ten minutes.

## 1. Get a Sandbox business

The Sandbox is a separate copy of TxGold with test money (see [The Sandbox](/sandbox)). TxGold
sets up your Sandbox business and gives you:

- its **account id** (for example `1000002`);
- one or two **demo customers**: Sandbox accounts that pay your payment requests on demand;
- an **owner key file**, which signs you in to the business portal for the Sandbox. The Sandbox has
  no phones, so this file stands in for the TxGold app.

Ask TxGold for a Sandbox business through your usual contact.

## 2. Create an integration and a key

1. Open the [business portal](https://business.txgold.money) and choose the **Sandbox** environment.
2. Sign in with your owner key file.
3. Under **Integrations**, create an integration. Its role is **Integration**, which can send,
   request, refund and see the balance.
4. Add a key. Either paste a public key you generated yourself, or let the portal generate one in
   your browser and download it. Choose an expiry of up to two years.

The portal downloads `txgold-sandbox-<name>.key.json`. It holds the **private key**: treat it like a
password, keep it out of source control and off browsers. TxGold only ever stores the public half.

## 3. Install an SDK

::: code-group

```bash [JavaScript]
npm install @txgold/business
```

```bash [Python]
pip install txgold-business
```

```bash [C#]
dotnet add package TxGold.Business
```

:::

Node.js 18.17+ (server side only), Python 3.9+, or .NET 8+ (or any netstandard2.1 runtime).

## 4. Check your account

::: code-group

```js [JavaScript]
import { TxGoldClient } from '@txgold/business';

const client = new TxGoldClient({ key: 'txgold-sandbox-mystore.key.json' });
const account = await client.accounts.get('1000002');
console.log(account.displayName, account.balance); // "Acme Sandbox" "60.20"
```

```python [Python]
from txgold_business import TxGoldClient

client = TxGoldClient("txgold-sandbox-mystore.key.json")
account = client.accounts.get("1000002")
print(account["displayName"], account["balance"])  # Acme Sandbox 60.20
```

```csharp [C#]
using TxGold.Business;

using var client = new TxGoldClient("txgold-sandbox-mystore.key.json");
var account = await client.Accounts.GetAsync("1000002");
Console.WriteLine($"{account.DisplayName} {account.Balance}"); // Acme Sandbox 60.20
```

:::

The client reads the environment from the key file, so a Sandbox key talks to the Sandbox.

If the balance is low, add test TxGold:

::: code-group

```js [JavaScript]
await client.sandbox.fund('1000002', '50.00');
```

```python [Python]
client.sandbox.fund("1000002", "50.00")
```

```csharp [C#]
await client.Sandbox.FundAsync("1000002", 50.00m);
```

:::

## 5. Send a payment

::: code-group

```js [JavaScript]
const payment = await client.payments.create({
  accountId: '1000002',            // yours: the account paying
  destinationAccountId: '1000004', // a demo customer
  amount: '1.00',                  // a decimal string, never a float
  memo: 'My first payment',
});
console.log(payment.id, payment.balanceAfter);
```

```python [Python]
payment = client.payments.create(
    "1000002",                         # yours: the account paying
    "1.00",                            # str or Decimal, never float
    destination_account_id="1000004",  # a demo customer
    memo="My first payment",
)
print(payment["id"], payment["balanceAfter"])
```

```csharp [C#]
var payment = await client.Payments.CreateAsync(new PaymentCreate
{
    AccountId = "1000002",            // yours: the account paying
    DestinationAccountId = "1000004", // a demo customer
    Amount = 1.00m,
    Memo = "My first payment",
});
Console.WriteLine($"{payment.Id} {payment.BalanceAfter}");
```

:::

## 6. Ask a customer to pay

::: code-group

```js [JavaScript]
const request = await client.paymentRequests.create({
  accountId: '1000002', payerAccountId: '1000004', amount: '12.50', memo: 'Invoice 4411',
});
// In the Sandbox, have the demo customer pay it:
await client.sandbox.payRequest(request.id);
console.log((await client.paymentRequests.get(request.id)).status); // "paid"
```

```python [Python]
request = client.payment_requests.create("1000002", "1000004", "12.50", memo="Invoice 4411")
# In the Sandbox, have the demo customer pay it:
client.sandbox.pay_request(request["id"])
print(client.payment_requests.get(request["id"])["status"])  # paid
```

```csharp [C#]
var request = await client.PaymentRequests.CreateAsync(new PaymentRequestCreate
{
    AccountId = "1000002", PayerAccountId = "1000004", Amount = 12.50m, Memo = "Invoice 4411",
});
// In the Sandbox, have the demo customer pay it:
await client.Sandbox.PayRequestAsync(request.Id);
Console.WriteLine((await client.PaymentRequests.GetAsync(request.Id)).Status); // paid
```

:::

In production the customer gets a push notification and pays in the TxGold app.

## 7. Handle errors

Every error is one exception type with a stable `code`:

::: code-group

```js [JavaScript]
import { TxGoldApiError } from '@txgold/business';

try {
  await client.payments.create({ accountId: '1000002', destinationAccountId: '1000004', amount: '999999.00' });
} catch (error) {
  if (error instanceof TxGoldApiError && error.code === 'insufficient_balance') {
    // tell the user; quote error.requestId to support if needed
  } else throw error;
}
```

```python [Python]
from txgold_business import TxGoldApiError

try:
    client.payments.create("1000002", "999999.00", destination_account_id="1000004")
except TxGoldApiError as error:
    if error.code != "insufficient_balance":
        raise
```

```csharp [C#]
try
{
    await client.Payments.CreateAsync(new PaymentCreate { AccountId = "1000002", DestinationAccountId = "1000004", Amount = 999999m });
}
catch (TxGoldApiException error) when (error.Code == "insufficient_balance")
{
    // tell the user; quote error.RequestId to support if needed
}
```

:::

The [error reference](/errors/) lists every code.

## Next

- Run the full tour in the [samples](https://github.com/tylerchessman/txgold-business/tree/main/samples).
- Read [Idempotency and retries](/guides/idempotency) before you go live: it's how a payment is never
  made twice.
- Signing in another language? See [Authentication](/authentication).
