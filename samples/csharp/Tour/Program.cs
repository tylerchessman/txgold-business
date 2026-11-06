// A tour of the TxGold Business API in the Sandbox: rates, your account, a payment, a payment
// request that a demo customer pays, a refund, and your transactions.
//
//   TXGOLD_KEY_FILE=txgold-sandbox-mystore.key.json TXGOLD_ACCOUNT_ID=1000002 TXGOLD_CUSTOMER_ID=1000004 dotnet run
//
// TXGOLD_ACCOUNT_ID is your business account (the key file's accountId when it has one) and
// TXGOLD_CUSTOMER_ID one of its Sandbox demo customers.
using TxGold.Business;

string Required(string name) =>
    Environment.GetEnvironmentVariable(name) is { Length: > 0 } value ? value : throw new InvalidOperationException($"Set {name}.");

string? baseUrl = Environment.GetEnvironmentVariable("TXGOLD_BASE_URL");
using var client = new TxGoldClient(new TxGoldClientOptions
{
    KeyFile = Required("TXGOLD_KEY_FILE"),
    BaseUrl = string.IsNullOrEmpty(baseUrl) ? null : new Uri(baseUrl),
    MaxRetries = 2,
});
string accountId = Required("TXGOLD_ACCOUNT_ID");
string customerId = Required("TXGOLD_CUSTOMER_ID");

try
{
    var rate = await client.Rates.GetAsync();
    Console.WriteLine($"1 TxGold = ${rate.UsdPerTxGold} (as of {rate.AsOf:u})");

    var account = await client.Accounts.GetAsync(accountId);
    Console.WriteLine($"Account {account.Id} @{account.AccountName}: balance {account.Balance}");
    if (account.Balance < 5m)
    {
        await client.Sandbox.FundAsync(accountId, 10m);
        Console.WriteLine($"Funded with test TxGold: balance {(await client.Accounts.GetAsync(accountId)).Balance}");
    }

    // Send a payment. Amounts are decimal.
    var payment = await client.Payments.CreateAsync(new PaymentCreate
    {
        AccountId = accountId, DestinationAccountId = customerId, Amount = 1.00m, Memo = "SDK tour: a payment",
    });
    Console.WriteLine($"Paid {payment.Amount} to {payment.DestinationAccountId}: payment {payment.Id}");

    // Ask the customer for a payment, and have the Sandbox customer pay it
    var request = await client.PaymentRequests.CreateAsync(new PaymentRequestCreate
    {
        AccountId = accountId, PayerAccountId = customerId, Amount = 0.50m, Memo = "SDK tour: a request",
    });
    Console.WriteLine($"Requested {request.Amount} from {request.PayerAccountId}: request {request.Id} is {request.Status}");
    var received = await client.Sandbox.PayRequestAsync(request.Id);
    var paid = await client.PaymentRequests.GetAsync(request.Id);
    Console.WriteLine($"The customer paid it: request {paid.Id} is {paid.Status}, payment {received.Id}");

    // Refund what the customer paid
    var refund = await client.Payments.RefundAsync(received.Id, new RefundCreate { Memo = "SDK tour: a refund" });
    Console.WriteLine($"Refunded {refund.Amount}: refund {refund.Id}");

    Console.WriteLine("Latest transactions:");
    foreach (var t in (await client.Accounts.TransactionsAsync(accountId, limit: 5)).Data)
        Console.WriteLine($"  {t.CreatedAt:u}  {t.Direction,-6} {t.Amount,8}  {t.Memo}");
}
catch (TxGoldApiException error)
{
    Console.Error.WriteLine($"API error {error.Status} {error.Code}: {error.Detail ?? error.Title} (request {error.RequestId})");
    return 1;
}
return 0;
