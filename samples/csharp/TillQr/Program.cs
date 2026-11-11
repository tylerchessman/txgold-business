// A shop counter: for each sale, the till makes a fresh open payment request and shows its QR code on
// the customer display. The customer scans it with the TxGold app and pays; the till sees it paid and
// prints the receipt. If the customer walks away, the till cancels the request.
//
//   TXGOLD_KEY_FILE=txgold-sandbox-mystore.key.json TXGOLD_ACCOUNT_ID=1000002 TXGOLD_CUSTOMER_ID=1000004 dotnet run [-- 1.25] [-- --no-pay]
//
// The optional argument is the sale amount (default 1.25). In the Sandbox the demo customer
// TXGOLD_CUSTOMER_ID pays; --no-pay leaves it unpaid to show the walk-away path. Writes till-qr.svg.
using System.Globalization;
using QRCoder;
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
bool simulatePayment = sandbox && !args.Contains("--no-pay");
string? customerId = simulatePayment ? Required("TXGOLD_CUSTOMER_ID") : null;
decimal amount = args.FirstOrDefault(a => !a.StartsWith("--")) is { } a1 ? decimal.Parse(a1, CultureInfo.InvariantCulture) : 1.25m;

// How long the till waits for a customer at the counter before giving up on the sale
var abandonAfter = TimeSpan.FromMinutes(2);

PaymentRequest? sale = null;
try
{
    // A fresh open request per sale: nobody can pay the same QR twice, and an old one can't be reused.
    // A short expiry means a QR photographed today is useless tomorrow.
    sale = await client.PaymentRequests.CreateAsync(new PaymentRequestCreate
    {
        AccountId = accountId,
        Amount = amount,
        Memo = "Corner Café",                         // the customer sees this
        MemoInternal = $"sale {DateTime.Now:yyyyMMdd-HHmmss}",
        Tag = "till-1",                               // which till; list or report by it later
        ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(15),
    });
    Console.WriteLine($"Sale {sale.Id}: {sale.Amount} TxGold. Scan to pay:");

    using (var qr = new QRCodeGenerator().CreateQrCode(sale.PaymentUrl!, QRCodeGenerator.ECCLevel.M))
    {
        // A real till draws this on its customer display; here, the console (block characters, so UTF-8)
        // and an SVG file
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.WriteLine(new AsciiQRCode(qr).GetGraphicSmall());
        File.WriteAllText("till-qr.svg", new SvgQRCode(qr).GetGraphic(8));
    }
    Console.WriteLine($"({sale.PaymentUrl})");

    if (simulatePayment)
    {
        // Sandbox only: in production the customer scans the code and pays in the TxGold app
        var simulated = await client.Sandbox.PayRequestAsync(sale.Id, customerId);
        Console.WriteLine($"(Sandbox) demo customer {customerId} paid: payment {simulated.Id}");
    }

    // A person is standing at the counter, so poll briskly: every 2 seconds, easing to 5
    var deadline = DateTimeOffset.UtcNow + abandonAfter;
    var wait = TimeSpan.FromSeconds(2);
    while (sale.Status == "pending" && DateTimeOffset.UtcNow < deadline)
    {
        await Task.Delay(wait);
        wait = TimeSpan.FromSeconds(Math.Min(wait.TotalSeconds * 1.25, 5));
        sale = await client.PaymentRequests.GetAsync(sale.Id);
    }

    if (sale.Status == "paid")
    {
        Console.WriteLine($"PAID {sale.Amount} at {sale.StatusChangedAt:T}. Receipt: payment {sale.PaymentId}");
        return 0;
    }
    if (sale.Status == "pending")
    {
        // Walked away: cancel, so the QR on the screen (or in someone's camera roll) can't be paid later
        sale = await client.PaymentRequests.CancelAsync(sale.Id);
        Console.WriteLine($"Sale abandoned: request {sale.Id} is {sale.Status}.");
        return 3;
    }
    Console.WriteLine($"Sale not paid: request {sale.Id} is {sale.Status}.");
    return 3;
}
catch (TxGoldApiException error)
{
    Console.Error.WriteLine($"API error {error.Status} {error.Code}: {error.Detail ?? error.Title} (request {error.RequestId})");
    if (sale?.Status == "pending")
        try { await client.PaymentRequests.CancelAsync(sale.Id); } catch (TxGoldApiException) { }
    return 1;
}
