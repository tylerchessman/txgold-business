// An invoice anyone can pay: an open payment request (no payer named) whose link you put on the
// invoice, in an email, or as a QR code. Whoever opens it in the TxGold app can pay it, once.
//
//   TXGOLD_KEY_FILE=txgold-sandbox-mystore.key.json TXGOLD_ACCOUNT_ID=1000002 TXGOLD_CUSTOMER_ID=1000004 dotnet run
//
// TXGOLD_ACCOUNT_ID is your business account and TXGOLD_CUSTOMER_ID one of its Sandbox demo customers,
// who pays the invoice here. Writes invoice-qr.svg and invoice-qr.png to the current folder.
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
string? customerId = sandbox ? Required("TXGOLD_CUSTOMER_ID") : null;

PaymentRequest? invoice = null;
try
{
    // No PayerAccountId or PayerHandle: an open request. It lasts 30 days by default (at most 90).
    invoice = await client.PaymentRequests.CreateAsync(new PaymentRequestCreate
    {
        AccountId = accountId,
        Amount = 1.50m,
        Memo = "Invoice 4411: October gardening",   // the payer sees this
        MemoInternal = "customer 88, invoice 4411",  // only you see this
        Tag = "invoices",                            // your own label, to find these later; never shown
    });
    Console.WriteLine($"Invoice request {invoice.Id}: {invoice.Amount} TxGold, {invoice.Status}, open={invoice.IsOpen}, expires {invoice.ExpiresAt:u}");
    Console.WriteLine($"Pay link: {invoice.PaymentUrl}");

    // The QR code is just the link. Editing the link's Amt or Memo changes nothing: the payer sees, and
    // must pay, the request's own amount and memo.
    using (var qr = new QRCodeGenerator().CreateQrCode(invoice.PaymentUrl!, QRCodeGenerator.ECCLevel.M))
    {
        File.WriteAllText("invoice-qr.svg", new SvgQRCode(qr).GetGraphic(8));
        File.WriteAllBytes("invoice-qr.png", new PngByteQRCode(qr).GetGraphic(8));
    }
    Console.WriteLine($"Wrote {Path.GetFullPath("invoice-qr.svg")} and invoice-qr.png");

    if (sandbox)
    {
        // Sandbox only: in production your customer scans the code (or taps the link) and pays in the app.
        // Without a payer, the Sandbox would use your first demo customer.
        var simulated = await client.Sandbox.PayRequestAsync(invoice.Id, customerId);
        Console.WriteLine($"(Sandbox) demo customer {customerId} paid it: payment {simulated.Id}");
    }

    // An invoice can take days, so a real system would check now and then (or on a schedule), not hold a
    // loop open. Here: poll with backoff for up to two minutes.
    var deadline = DateTimeOffset.UtcNow.AddMinutes(2);
    var wait = TimeSpan.FromSeconds(2);
    while (invoice.Status == "pending" && DateTimeOffset.UtcNow < deadline)
    {
        await Task.Delay(wait);
        wait = TimeSpan.FromSeconds(Math.Min(wait.TotalSeconds * 1.5, 15));
        invoice = await client.PaymentRequests.GetAsync(invoice.Id);
    }

    if (invoice.Status == "paid")
    {
        // Once paid, an open request tells you who paid it
        Console.WriteLine($"Paid by account {invoice.PayerAccountId}: payment {invoice.PaymentId}");

        if (sandbox)
        {
            // An open request is payable once: a second payment is refused
            try { await client.Sandbox.PayRequestAsync(invoice.Id, customerId); }
            catch (TxGoldApiException error) { Console.WriteLine($"Paying it again: {error.Status} {error.Code}, as expected"); }
        }
        return 0;
    }

    Console.WriteLine($"Request {invoice.Id} is {invoice.Status}.");
    if (invoice.Status == "pending")
    {
        // Still open. A real invoice would stay open until it expires; this sample tidies up after itself.
        invoice = await client.PaymentRequests.CancelAsync(invoice.Id);
        Console.WriteLine($"Cancelled it: {invoice.Status}");
    }
    return 3;
}
catch (TxGoldApiException error)
{
    Console.Error.WriteLine($"API error {error.Status} {error.Code}: {error.Detail ?? error.Title} (request {error.RequestId})");
    if (invoice?.Status == "pending")
        try { await client.PaymentRequests.CancelAsync(invoice.Id); } catch (TxGoldApiException) { }
    return 1;
}
