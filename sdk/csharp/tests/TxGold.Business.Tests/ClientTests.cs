using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Web;

namespace TxGold.Business.Tests;

public class ClientTests
{
    private static readonly ECDsa Ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);
    private static readonly SigningKey Key = SigningKey.FromECDsa(Ecdsa);

    private sealed record Sent(HttpMethod Method, Uri Uri, Dictionary<string, string> Headers, byte[] Body);

    /// <summary>An HttpClient that records each request and answers from <paramref name="responses"/>.</summary>
    private sealed class FakeHandler(params object[] responses) : HttpMessageHandler
    {
        private readonly Queue<object> _responses = new(responses);
        public List<Sent> Sent { get; } = new();

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            byte[] body = request.Content is null ? [] : await request.Content.ReadAsByteArrayAsync(cancellationToken);
            Sent.Add(new Sent(request.Method, request.RequestUri!,
                request.Headers.Where(h => h.Key.StartsWith("TxG-")).ToDictionary(h => h.Key, h => h.Value.Single()), body));
            var next = _responses.Dequeue();
            if (next is Exception exception)
                throw exception;
            var (status, json) = ((HttpStatusCode, object?))next;
            return new HttpResponseMessage(status)
            {
                Content = json is null ? new ByteArrayContent([]) : new StringContent(JsonSerializer.Serialize(json), Encoding.UTF8, "application/json"),
            };
        }
    }

    private static (TxGoldClient Client, FakeHandler Handler) Client(int maxRetries, params object[] responses)
    {
        var handler = new FakeHandler(responses);
        var client = new TxGoldClient(new TxGoldClientOptions
        {
            Key = Key, BaseUrl = new Uri("https://api.test/"), HttpClient = new HttpClient(handler), MaxRetries = maxRetries,
        });
        return (client, handler);
    }

    private static object Ok(object? body = null, HttpStatusCode status = HttpStatusCode.OK) => (status, body);

    private static readonly object PaymentJson = new
    {
        id = "88", accountId = "1000002", destinationAccountId = "1000004", direction = "debit", amount = "1.25", fee = (string?)null,
        memo = "Café ☕", memoInternal = (string?)null, createdAt = "2026-11-06T17:23:20.189Z", paymentRequestId = (string?)null,
        refundOf = (string?)null, refundId = (string?)null, refundedAmount = (string?)null, balanceAfter = "61.21",
    };

    // The server rebuilds the canonical string from the request it receives; so does this
    private static void AssertSigned(Sent s)
    {
        string canonical = RequestSigning.CanonicalString(s.Method.Method, s.Uri.AbsolutePath, s.Uri.Query.TrimStart('?'), s.Headers["TxG-Timestamp"], s.Body);
        Assert.Equal(Key.KeyId, s.Headers["TxG-Key-Id"]);
        Assert.True(RequestSigning.Verify(Ecdsa, canonical, s.Headers["TxG-Signature"]), "signature over the sent request");
    }

    [Fact]
    public async Task A_POST_signs_exactly_the_bytes_it_sends_non_ASCII_included()
    {
        var (client, handler) = Client(0, Ok(PaymentJson, HttpStatusCode.Created));
        var payment = await client.Payments.CreateAsync(new PaymentCreate
        {
            AccountId = "1000002", DestinationAccountId = "1000004", Amount = 1.25m, Memo = "Café ☕",
        });

        Assert.Equal(("88", 1.25m, 61.21m), (payment.Id, payment.Amount, payment.BalanceAfter));
        var s = Assert.Single(handler.Sent);
        Assert.Equal("https://api.test/v1/payments", s.Uri.ToString());
        string body = Encoding.UTF8.GetString(s.Body);
        Assert.Contains("\"amount\":\"1.25\"", body);
        Assert.Contains("Café ☕", body);
        Assert.DoesNotContain("paymentRequestId", body); // nulls are left out
        AssertSigned(s);
    }

    [Fact]
    public async Task A_GET_signs_its_query_string_as_sent()
    {
        var (client, handler) = Client(0, Ok(new { data = Array.Empty<object>(), nextCursor = (string?)null }));
        await client.Accounts.TransactionsAsync("1000002", from: new DateTimeOffset(2026, 11, 1, 0, 0, 0, TimeSpan.FromHours(5)), limit: 10, cursor: "a+b/c=");

        var s = Assert.Single(handler.Sent);
        Assert.Equal("/v1/accounts/1000002/transactions", s.Uri.AbsolutePath);
        var query = HttpUtility.ParseQueryString(s.Uri.Query);
        Assert.Equal(("2026-10-31T19:00:00.000Z", "a+b/c=", "10"), (query["from"], query["cursor"], query["limit"]));
        Assert.Empty(s.Body);
        AssertSigned(s);
    }

    [Fact]
    public async Task Amounts_with_more_than_two_places_are_refused()
    {
        var (client, handler) = Client(0);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            client.Payments.CreateAsync(new PaymentCreate { AccountId = "1", DestinationAccountId = "2", Amount = 1.005m }));
        Assert.Empty(handler.Sent);
    }

    [Fact]
    public async Task An_explicit_timestamp_is_used_as_given()
    {
        var (client, handler) = Client(0, Ok(PaymentJson));
        await client.Payments.CreateAsync(new PaymentCreate { AccountId = "1", DestinationAccountId = "2", Amount = 1m }, timestamp: "639283104000000000");
        Assert.Equal("639283104000000000", handler.Sent[0].Headers["TxG-Timestamp"]);
        AssertSigned(handler.Sent[0]);
    }

    [Fact]
    public async Task Problem_json_becomes_TxGoldApiException()
    {
        var problem = new { type = "https://docs.txgold.money/errors/invalid_request", title = "Invalid request", status = 400,
            code = "invalid_request", detail = "The request has invalid fields.", requestId = "abc123",
            errors = new Dictionary<string, string[]> { ["amount"] = ["Must be a decimal string."] } };
        var (client, _) = Client(0, Ok(problem, HttpStatusCode.BadRequest));
        var error = await Assert.ThrowsAsync<TxGoldApiException>(() =>
            client.Payments.CreateAsync(new PaymentCreate { AccountId = "1", DestinationAccountId = "2", Amount = 1m }));
        Assert.Equal((400, "invalid_request", "abc123"), (error.Status, error.Code, error.RequestId));
        Assert.Equal(["Must be a decimal string."], error.Errors!["amount"]);
    }

    [Fact]
    public async Task Retries_resend_the_identical_signed_request()
    {
        var (client, handler) = Client(2, new HttpRequestException("refused"), Ok(null, HttpStatusCode.ServiceUnavailable), Ok(PaymentJson, HttpStatusCode.Created));
        var payment = await client.Payments.CreateAsync(new PaymentCreate { AccountId = "1", DestinationAccountId = "2", Amount = 1m });
        Assert.Equal("88", payment.Id);
        Assert.Equal(3, handler.Sent.Count);
        Assert.Single(handler.Sent.Select(s => s.Headers["TxG-Timestamp"] + s.Headers["TxG-Signature"] + Convert.ToBase64String(s.Body)).Distinct());
    }

    [Fact]
    public async Task No_retries_by_default()
    {
        var (client, handler) = Client(0, Ok(new { code = "rate_unavailable", status = 503 }, HttpStatusCode.ServiceUnavailable));
        await Assert.ThrowsAsync<TxGoldApiException>(() => client.Rates.GetAsync());
        Assert.Single(handler.Sent);
    }

    [Fact]
    public async Task ListAll_follows_nextCursor()
    {
        object Request(string id) => new { id, status = "pending", accountId = "1", payerAccountId = "2", amount = "1.00",
            createdAt = "2026-11-06T00:00:00.000Z", expiresAt = "2026-11-07T00:00:00.000Z" };
        var (client, handler) = Client(0,
            Ok(new { data = new[] { Request("1"), Request("2") }, nextCursor = "next" }),
            Ok(new { data = new[] { Request("3") }, nextCursor = (string?)null }));
        var ids = new List<string>();
        await foreach (var r in client.PaymentRequests.ListAllAsync("1000002", status: "pending"))
            ids.Add(r.Id);
        Assert.Equal(["1", "2", "3"], ids);
        var query = HttpUtility.ParseQueryString(handler.Sent[1].Uri.Query);
        Assert.Equal(("next", "pending"), (query["cursor"], query["status"]));
    }

    [Fact]
    public void An_environment_without_a_known_URL_needs_BaseUrl()
    {
        var error = Assert.Throws<ArgumentException>(() => new TxGoldClient(new TxGoldClientOptions { Key = Key, Environment = "production" }));
        Assert.Contains("set BaseUrl", error.Message);
    }
}
