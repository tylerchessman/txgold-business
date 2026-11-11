using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace TxGold.Business;

/// <summary>Send, get and refund payments.</summary>
public sealed class PaymentsResource
{
    private readonly TxGoldClient _client;
    internal PaymentsResource(TxGoldClient client) => _client = client;

    /// <summary>
    /// Sends a payment (201), or returns the original one (200) for a resend with the same
    /// <paramref name="timestamp"/>.
    /// </summary>
    public Task<Payment> CreateAsync(PaymentCreate payment, string? timestamp = null, CancellationToken cancellationToken = default) =>
        _client.SendAsync<Payment>(HttpMethod.Post, "/v1/payments", body: payment, timestamp: timestamp, cancellationToken: cancellationToken);

    /// <summary>One payment, seen from <paramref name="accountId"/> (the payer or the payee).</summary>
    public Task<Payment> GetAsync(string paymentId, string accountId, CancellationToken cancellationToken = default) =>
        _client.SendAsync<Payment>(HttpMethod.Get, $"/v1/payments/{Segment(paymentId)}",
            new[] { Pair("accountId", accountId) }, cancellationToken: cancellationToken);

    /// <summary>Refunds a payment your account received, in whole or in part.</summary>
    public Task<Payment> RefundAsync(string paymentId, RefundCreate? refund = null, string? timestamp = null, CancellationToken cancellationToken = default) =>
        _client.SendAsync<Payment>(HttpMethod.Post, $"/v1/payments/{Segment(paymentId)}/refunds",
            body: refund ?? new RefundCreate(), timestamp: timestamp, cancellationToken: cancellationToken);

    internal static string Segment(string value) => Uri.EscapeDataString(value);
    internal static KeyValuePair<string, string?> Pair(string name, string? value) => new(name, value);
}

/// <summary>Ask other accounts to pay you.</summary>
public sealed class PaymentRequestsResource
{
    private readonly TxGoldClient _client;
    internal PaymentRequestsResource(TxGoldClient client) => _client = client;

    /// <summary>
    /// Asks the payer to pay your account, or with no payer named, makes an open request whose
    /// <see cref="PaymentRequest.PaymentUrl"/> anyone can pay once.
    /// </summary>
    public Task<PaymentRequest> CreateAsync(PaymentRequestCreate request, string? timestamp = null, CancellationToken cancellationToken = default) =>
        _client.SendAsync<PaymentRequest>(HttpMethod.Post, "/v1/payment-requests", body: request, timestamp: timestamp, cancellationToken: cancellationToken);

    /// <summary>One request.</summary>
    public Task<PaymentRequest> GetAsync(string requestId, CancellationToken cancellationToken = default) =>
        _client.SendAsync<PaymentRequest>(HttpMethod.Get, $"/v1/payment-requests/{PaymentsResource.Segment(requestId)}", cancellationToken: cancellationToken);

    /// <summary>A page of requests. <paramref name="status"/>: pending, paid, dismissed, cancelled or expired.</summary>
    public Task<Page<PaymentRequest>> ListAsync(string accountId, string? status = null, int? limit = null, string? cursor = null,
        CancellationToken cancellationToken = default) =>
        _client.SendAsync<Page<PaymentRequest>>(HttpMethod.Get, "/v1/payment-requests", new[]
        {
            PaymentsResource.Pair("accountId", accountId),
            PaymentsResource.Pair("status", status),
            PaymentsResource.Pair("limit", limit?.ToString(CultureInfo.InvariantCulture)),
            PaymentsResource.Pair("cursor", cursor),
        }, cancellationToken: cancellationToken);

    /// <summary>Every request, across pages.</summary>
    public IAsyncEnumerable<PaymentRequest> ListAllAsync(string accountId, string? status = null, int? limit = null,
        CancellationToken cancellationToken = default) =>
        _client.PaginateAsync(cursor => ListAsync(accountId, status, limit, cursor, cancellationToken), cancellationToken);

    /// <summary>Withdraws a pending request.</summary>
    public Task<PaymentRequest> CancelAsync(string requestId, CancellationToken cancellationToken = default) =>
        _client.SendAsync<PaymentRequest>(HttpMethod.Post, $"/v1/payment-requests/{PaymentsResource.Segment(requestId)}/cancel",
            cancellationToken: cancellationToken);
}

/// <summary>Your accounts, their history, and business lookup.</summary>
public sealed class AccountsResource
{
    private readonly TxGoldClient _client;
    internal AccountsResource(TxGoldClient client) => _client = client;

    /// <summary>One account your key acts for.</summary>
    public Task<Account> GetAsync(string accountId, CancellationToken cancellationToken = default) =>
        _client.SendAsync<Account>(HttpMethod.Get, $"/v1/accounts/{PaymentsResource.Segment(accountId)}", cancellationToken: cancellationToken);

    /// <summary>
    /// A page of transactions, newest first. <paramref name="from"/> inclusive, <paramref name="to"/> exclusive.
    /// </summary>
    public Task<Page<AccountTransaction>> TransactionsAsync(string accountId, DateTimeOffset? from = null, DateTimeOffset? to = null,
        int? limit = null, string? cursor = null, CancellationToken cancellationToken = default) =>
        _client.SendAsync<Page<AccountTransaction>>(HttpMethod.Get, $"/v1/accounts/{PaymentsResource.Segment(accountId)}/transactions", new[]
        {
            PaymentsResource.Pair("from", Iso(from)),
            PaymentsResource.Pair("to", Iso(to)),
            PaymentsResource.Pair("limit", limit?.ToString(CultureInfo.InvariantCulture)),
            PaymentsResource.Pair("cursor", cursor),
        }, cancellationToken: cancellationToken);

    /// <summary>Every transaction in the range, across pages.</summary>
    public IAsyncEnumerable<AccountTransaction> TransactionsAllAsync(string accountId, DateTimeOffset? from = null, DateTimeOffset? to = null,
        int? limit = null, CancellationToken cancellationToken = default) =>
        _client.PaginateAsync(cursor => TransactionsAsync(accountId, from, to, limit, cursor, cancellationToken), cancellationToken);

    /// <summary>A business or charity by its handle, with or without the @.</summary>
    public Task<AccountLookup> LookupAsync(string accountName, CancellationToken cancellationToken = default) =>
        _client.SendAsync<AccountLookup>(HttpMethod.Get, "/v1/accounts/lookup",
            new[] { PaymentsResource.Pair("accountName", accountName) }, cancellationToken: cancellationToken);

    private static string? Iso(DateTimeOffset? value) =>
        value?.ToUniversalTime().ToString("yyyy'-'MM'-'dd'T'HH':'mm':'ss'.'fff'Z'", CultureInfo.InvariantCulture);
}

/// <summary>The TxGold rate.</summary>
public sealed class RatesResource
{
    private readonly TxGoldClient _client;
    internal RatesResource(TxGoldClient client) => _client = client;

    /// <summary>The current TxGold rate.</summary>
    public Task<Rate> GetAsync(CancellationToken cancellationToken = default) =>
        _client.SendAsync<Rate>(HttpMethod.Get, "/v1/rates", cancellationToken: cancellationToken);
}

/// <summary>Sandbox-only helpers. They return 404 in production.</summary>
public sealed class SandboxResource
{
    private readonly TxGoldClient _client;
    internal SandboxResource(TxGoldClient client) => _client = client;

    /// <summary>Adds test TxGold to one of your accounts, or one of its demo customers.</summary>
    public Task<Payment> FundAsync(string accountId, decimal amount, CancellationToken cancellationToken = default) =>
        _client.SendAsync<Payment>(HttpMethod.Post, $"/v1/sandbox/accounts/{PaymentsResource.Segment(accountId)}/fund",
            body: new FundBody { Amount = amount }, cancellationToken: cancellationToken);

    /// <summary>
    /// Has the demo customer a pending request was sent to pay it, as they would in the app. An open request
    /// is paid by your first demo customer.
    /// </summary>
    public Task<Payment> PayRequestAsync(string requestId, CancellationToken cancellationToken = default) =>
        PayRequestAsync(requestId, null, cancellationToken);

    /// <summary>
    /// Has a demo customer pay a pending request, as they would in the app. <paramref name="payerAccountId"/>
    /// picks which of your demo customers pays an open request (null: your first); it is ignored for a request
    /// to a named payer.
    /// </summary>
    public Task<Payment> PayRequestAsync(string requestId, string? payerAccountId, CancellationToken cancellationToken = default) =>
        _client.SendAsync<Payment>(HttpMethod.Post, $"/v1/sandbox/payment-requests/{PaymentsResource.Segment(requestId)}/pay",
            // No body at all unless a payer is named; the signature covers the (empty) body as sent
            body: payerAccountId is null ? null : new PayBody { PayerAccountId = payerAccountId },
            cancellationToken: cancellationToken);

    private sealed class PayBody
    {
        public string? PayerAccountId { get; init; }
    }

    private sealed class FundBody
    {
        [System.Text.Json.Serialization.JsonConverter(typeof(MoneyConverter))]
        public decimal Amount { get; init; }
    }
}
