// A link (and QR code) to pay your account, made without calling the API: for a tip jar, a donation
// poster, or a "pay us" button. It opens the TxGold app's payment screen with your account filled in.
//
//   TXGOLD_ACCOUNT_ID=1000002 TXGOLD_ACCOUNT_NAME=MyStore [TXGOLD_AMOUNT=5.00] [TXGOLD_MEMO="Tip jar"] dotnet run
//
// TXGOLD_ACCOUNT_NAME is your handle (without the @). Writes account-qr.svg to the current folder.
//
// The payer can change Amt and Memo on a link like this: they are only suggestions. To be paid a fixed
// amount, make an open payment request and share its PaymentUrl instead (see InvoiceLink and TillQr).
using System.Globalization;
using QRCoder;

string Required(string name) =>
    Environment.GetEnvironmentVariable(name) is { Length: > 0 } value ? value : throw new InvalidOperationException($"Set {name}.");
string? Optional(string name) => Environment.GetEnvironmentVariable(name) is { Length: > 0 } value ? value : null;

string accountId = Required("TXGOLD_ACCOUNT_ID");
string accountName = Required("TXGOLD_ACCOUNT_NAME").TrimStart('@');
decimal? amount = Optional("TXGOLD_AMOUNT") is { } a ? decimal.Parse(a, CultureInfo.InvariantCulture) : null;
string? memo = Optional("TXGOLD_MEMO");

// The app finds your account by AccountId, so the link keeps working if you rename your handle;
// AccountName is what the payer sees while it loads.
var query = new List<string>
{
    "AccountId=" + Uri.EscapeDataString(accountId),
    "AccountName=" + Uri.EscapeDataString(accountName),
};
if (amount is { } amt)
    query.Add("Amt=" + Uri.EscapeDataString(amt.ToString("0.00", CultureInfo.InvariantCulture)));
if (memo is not null)
    query.Add("Memo=" + Uri.EscapeDataString(memo)); // spaces become %20, & and # are escaped
string link = "https://app.txgold.money/RequestPayment?" + string.Join("&", query);
Console.WriteLine(link);

using var qr = new QRCodeGenerator().CreateQrCode(link, QRCodeGenerator.ECCLevel.M);
File.WriteAllText("account-qr.svg", new SvgQRCode(qr).GetGraphic(8));
Console.WriteLine($"Wrote {Path.GetFullPath("account-qr.svg")}");
