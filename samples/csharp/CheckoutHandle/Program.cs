// Website checkout by TxGold handle: the customer types their handle (@Jason-Miles, say) at your
// checkout, you send them a payment request, they approve it in the TxGold app, and your server polls
// the request until it is paid. If they never approve, you cancel it.
//
//   TXGOLD_KEY_FILE=txgold-sandbox-mystore.key.json TXGOLD_ACCOUNT_ID=1000002 TXGOLD_PAYER_HANDLE=@Jason-Miles dotnet run
//
// TXGOLD_ACCOUNT_ID is your business account and TXGOLD_PAYER_HANDLE the customer's handle. A request by
// handle never tells you the payer's account id: the handle is all your checkout needs.
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
string payerHandle = Required("TXGOLD_PAYER_HANDLE");
bool sandbox = client.BaseUrl == TxGoldClient.BaseUrls["sandbox"];

// How long the customer has to approve before checkout gives up. The request itself expires later
// (here 15 minutes), but your checkout should not wait that long.
var checkoutTimeout = TimeSpan.FromMinutes(3);

PaymentRequest request;
try
{
    request = await client.PaymentRequests.CreateAsync(new PaymentRequestCreate
    {
        AccountId = accountId,
        PayerHandle = payerHandle,                   // a leading @ is ignored
        Amount = 1.25m,
        Memo = "Order 1042: 1 coffee",               // the customer sees this in the app
        MemoInternal = "web-order-1042",             // only you see this
        ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(15),
    });
}
catch (TxGoldApiException error) when (error.Code == "payer_account_invalid")
{
    // Show this at the checkout: no active TxGold account has that handle
    Console.Error.WriteLine($"No TxGold account is called {payerHandle}; check the handle. ({error.Status} {error.Code}, request {error.RequestId})");
    return 2;
}
catch (TxGoldApiException error)
{
    Console.Error.WriteLine($"API error {error.Status} {error.Code}: {error.Detail ?? error.Title} (request {error.RequestId})");
    return 1;
}
Console.WriteLine($"Asked {payerHandle} for {request.Amount}: request {request.Id} is {request.Status}. Approve it in the TxGold app.");

try
{
    if (sandbox)
    {
        // Sandbox only: in production the customer approves in the app. This works when the handle is
        // one of your Sandbox demo customers.
        var simulated = await client.Sandbox.PayRequestAsync(request.Id);
        Console.WriteLine($"(Sandbox) the demo customer approved it: payment {simulated.Id}");
    }

    // Poll with backoff: quick at first, when an approval is most likely, then slower
    var deadline = DateTimeOffset.UtcNow + checkoutTimeout;
    var wait = TimeSpan.FromSeconds(2);
    while (request.Status == "pending" && DateTimeOffset.UtcNow < deadline)
    {
        await Task.Delay(wait);
        wait = TimeSpan.FromSeconds(Math.Min(wait.TotalSeconds * 1.5, 15));
        request = await client.PaymentRequests.GetAsync(request.Id);
        Console.WriteLine($"  {DateTimeOffset.UtcNow:T}  {request.Status}");
    }

    switch (request.Status)
    {
        case "paid":
            Console.WriteLine($"Paid: payment {request.PaymentId}. Fulfil the order.");
            return 0;
        case "pending":
            // Abandoned: withdraw the request so the customer can't pay an order you've given up on
            request = await client.PaymentRequests.CancelAsync(request.Id);
            Console.WriteLine($"Not approved in time: request {request.Id} is {request.Status}.");
            return 3;
        default:
            // dismissed (the customer declined), cancelled or expired
            Console.WriteLine($"Not paid: request {request.Id} is {request.Status}.");
            return 3;
    }
}
catch (TxGoldApiException error)
{
    Console.Error.WriteLine($"API error {error.Status} {error.Code}: {error.Detail ?? error.Title} (request {error.RequestId})");
    // Leave nothing payable behind
    try { await client.PaymentRequests.CancelAsync(request.Id); } catch (TxGoldApiException) { }
    return 1;
}
