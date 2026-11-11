// Hand off to the TxGold app: your own mobile app (or a web page on a phone) takes an order, your server
// makes an open payment request, and your app opens its PaymentUrl. That link opens the TxGold app on
// the request, the customer pays there, and your server sees the request paid.
//
//   TXGOLD_KEY_FILE=txgold-sandbox-mystore.key.json TXGOLD_ACCOUNT_ID=1000002 TXGOLD_CUSTOMER_ID=1000004 dotnet run [-- --open]
//
// --open also opens the link with this computer's default handler, as a phone app would. In the
// Sandbox the demo customer TXGOLD_CUSTOMER_ID pays.
//
// Keep the signing key on your server. A phone app should never hold it: it asks your server for the
// request, gets back the PaymentUrl, and opens it.
using System.Diagnostics;
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
bool sandbox = client.BaseUrl == TxGoldClient.BaseUrls["sandbox"];
string? customerId = sandbox ? Required("TXGOLD_CUSTOMER_ID") : null;

PaymentRequest? request = null;
try
{
    // --- On your server ---
    request = await client.PaymentRequests.CreateAsync(new PaymentRequestCreate
    {
        AccountId = accountId,
        Amount = 1.00m,
        Memo = "Ride 7731: Airport to Downtown",
        Tag = "mobile-app",
        ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(30),
    });
    Console.WriteLine($"Request {request.Id}: {request.Amount} TxGold, {request.Status}");
    Console.WriteLine($"Hand this to the app: {request.PaymentUrl}");

    // --- In your app ---
    // .NET MAUI:
    //     await Launcher.Default.OpenAsync(new Uri(paymentUrl));
    // Android (Kotlin):
    //     startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(paymentUrl)))
    // iOS (Swift):
    //     UIApplication.shared.open(URL(string: paymentUrl)!)
    // A web page:
    //     <a href="{paymentUrl}">Pay with TxGold</a>
    // With the TxGold app installed the link opens it on this request; otherwise it opens in the browser
    // at app.txgold.money.
    if (args.Contains("--open"))
        Process.Start(new ProcessStartInfo(request.PaymentUrl!) { UseShellExecute = true });

    if (sandbox)
    {
        // Sandbox only: in production the customer pays in the TxGold app
        var simulated = await client.Sandbox.PayRequestAsync(request.Id, customerId);
        Console.WriteLine($"(Sandbox) demo customer {customerId} paid: payment {simulated.Id}");
    }

    // --- Back on your server ---
    // When the customer returns to your app, it asks your server, which polls (with backoff) until paid
    var deadline = DateTimeOffset.UtcNow.AddMinutes(3);
    var wait = TimeSpan.FromSeconds(2);
    while (request.Status == "pending" && DateTimeOffset.UtcNow < deadline)
    {
        await Task.Delay(wait);
        wait = TimeSpan.FromSeconds(Math.Min(wait.TotalSeconds * 1.5, 15));
        request = await client.PaymentRequests.GetAsync(request.Id);
    }

    if (request.Status == "paid")
    {
        Console.WriteLine($"Paid by account {request.PayerAccountId}: payment {request.PaymentId}");
        return 0;
    }
    if (request.Status == "pending")
    {
        request = await client.PaymentRequests.CancelAsync(request.Id);
        Console.WriteLine($"Not paid in time: request {request.Id} is {request.Status}.");
        return 3;
    }
    Console.WriteLine($"Not paid: request {request.Id} is {request.Status}.");
    return 3;
}
catch (TxGoldApiException error)
{
    Console.Error.WriteLine($"API error {error.Status} {error.Code}: {error.Detail ?? error.Title} (request {error.RequestId})");
    if (request?.Status == "pending")
        try { await client.PaymentRequests.CancelAsync(request.Id); } catch (TxGoldApiException) { }
    return 1;
}
