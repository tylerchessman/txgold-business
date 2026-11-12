using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace TxGold.Business;

/// <summary>Options for <see cref="TxGoldClient"/>.</summary>
public sealed class TxGoldClientOptions
{
    /// <summary>The signing key. Set this or <see cref="KeyFile"/>.</summary>
    public SigningKey? Key { get; set; }

    /// <summary>A key file from the business portal. Set this or <see cref="Key"/>.</summary>
    public string? KeyFile { get; set; }

    /// <summary>"sandbox" or "production". Default: the key file's environment, else "sandbox".</summary>
    public string? Environment { get; set; }

    /// <summary>Overrides the environment's URL (a local host, for example).</summary>
    public Uri? BaseUrl { get; set; }

    /// <summary>
    /// Retries after a network error or a 502/503/504, re-sending the identical signed request (same
    /// timestamp), so a payment is never made twice. Default 0.
    /// </summary>
    public int MaxRetries { get; set; }

    /// <summary>Per-attempt timeout when the client makes its own HttpClient. Default 30 seconds.</summary>
    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(30);

    /// <summary>Your own HttpClient (from IHttpClientFactory, say). Not disposed by the client.</summary>
    public HttpClient? HttpClient { get; set; }
}

/// <summary>The TxGold Business API. Every request is signed with the key it was made with.</summary>
public sealed class TxGoldClient : IDisposable
{
    /// <summary>The SDK version, sent in the User-Agent.</summary>
    public const string Version = "0.2.0";

    /// <summary>The API's base URL per environment. Production is added when it opens.</summary>
    public static readonly IReadOnlyDictionary<string, Uri> BaseUrls = new Dictionary<string, Uri>
    {
        ["sandbox"] = new("https://func-txgbusiness-dev-ffdea6gbbjhzczex.southcentralus-01.azurewebsites.net"),
    };

    internal static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        // Memos go out as UTF-8 as typed, not \u escapes; the signature covers whatever bytes are sent
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private static readonly HashSet<HttpStatusCode> RetryStatuses = new() { HttpStatusCode.BadGateway, HttpStatusCode.ServiceUnavailable, HttpStatusCode.GatewayTimeout };

    private readonly SigningKey _key;
    private readonly bool _ownsKey;
    private readonly HttpClient _http;
    private readonly bool _ownsHttp;
    private readonly TimestampClock _clock = new();
    private readonly int _maxRetries;

    /// <summary>Creates a client with a key file from the business portal.</summary>
    public TxGoldClient(string keyFile) : this(new TxGoldClientOptions { KeyFile = keyFile }) { }

    /// <summary>Creates a client.</summary>
    public TxGoldClient(TxGoldClientOptions options)
    {
        if (options.Key is null && options.KeyFile is null)
            throw new ArgumentException("Set Key or KeyFile.", nameof(options));
        _ownsKey = options.Key is null;
        _key = options.Key ?? SigningKey.FromKeyFile(options.KeyFile!);
        string environment = options.Environment ?? _key.Environment ?? "sandbox";
        BaseUrl = options.BaseUrl ?? (BaseUrls.TryGetValue(environment, out var known) ? known
            : throw new ArgumentException($"No base URL is known for the \"{environment}\" environment yet; set BaseUrl.", nameof(options)));
        _maxRetries = options.MaxRetries;
        _ownsHttp = options.HttpClient is null;
        _http = options.HttpClient ?? new HttpClient { Timeout = options.Timeout };

        Payments = new PaymentsResource(this);
        PaymentRequests = new PaymentRequestsResource(this);
        Accounts = new AccountsResource(this);
        Rates = new RatesResource(this);
        Sandbox = new SandboxResource(this);
    }

    /// <summary>The API's base URL.</summary>
    public Uri BaseUrl { get; }

    /// <summary>The TxG-Key-Id this client signs with.</summary>
    public string KeyId => _key.KeyId;

    /// <summary>Send, get and refund payments.</summary>
    public PaymentsResource Payments { get; }

    /// <summary>Ask other accounts to pay you.</summary>
    public PaymentRequestsResource PaymentRequests { get; }

    /// <summary>Your accounts, their history, and business lookup.</summary>
    public AccountsResource Accounts { get; }

    /// <summary>The TxGold rate.</summary>
    public RatesResource Rates { get; }

    /// <summary>Sandbox-only helpers. They return 404 in production.</summary>
    public SandboxResource Sandbox { get; }

    /// <summary>
    /// Sends one signed request and returns the parsed body. Throws <see cref="TxGoldApiException"/>.
    /// <paramref name="timestamp"/> signs with a given TxG-Timestamp: resending a request with the same
    /// timestamp (and body) is idempotent, returning the original result instead of acting twice.
    /// </summary>
    public async Task<T> SendAsync<T>(HttpMethod method, string path, IEnumerable<KeyValuePair<string, string?>>? query = null,
        object? body = null, string? timestamp = null, CancellationToken cancellationToken = default)
    {
        string queryString = QueryString(query);
        // The signature covers these exact bytes, and they are what is sent
        byte[] content = body is null ? Array.Empty<byte>() : JsonSerializer.SerializeToUtf8Bytes(body, body.GetType(), Json);
        string ts = timestamp ?? _clock.Next();
        string signature = RequestSigning.Sign(_key.PrivateKey, RequestSigning.CanonicalString(method.Method, path, queryString, ts, content));
        var uri = new Uri(BaseUrl, path + (queryString.Length > 0 ? "?" + queryString : ""));

        for (int attempt = 0; ; attempt++)
        {
            using var request = new HttpRequestMessage(method, uri);
            request.Headers.Add("TxG-Key-Id", _key.KeyId);
            request.Headers.Add("TxG-Timestamp", ts);
            request.Headers.Add("TxG-Signature", signature);
            request.Headers.Accept.ParseAdd("application/json");
            request.Headers.UserAgent.ParseAdd($"txgold-business-dotnet/{Version}");
            if (body is not null)
            {
                request.Content = new ByteArrayContent(content);
                request.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");
            }

            HttpResponseMessage response;
            try
            {
                response = await _http.SendAsync(request, cancellationToken).ConfigureAwait(false);
            }
            catch (HttpRequestException) when (attempt < _maxRetries)
            {
                await Delay(attempt, cancellationToken).ConfigureAwait(false);
                continue;
            }
            catch (TaskCanceledException) when (attempt < _maxRetries && !cancellationToken.IsCancellationRequested)
            {
                await Delay(attempt, cancellationToken).ConfigureAwait(false);
                continue;
            }

            using (response)
            {
                if (RetryStatuses.Contains(response.StatusCode) && attempt < _maxRetries)
                {
                    await Delay(attempt, cancellationToken).ConfigureAwait(false);
                    continue;
                }
                byte[] responseBody = await response.Content.ReadAsByteArrayAsync().ConfigureAwait(false);
                if (!response.IsSuccessStatusCode)
                    throw new TxGoldApiException((int)response.StatusCode, Problem(responseBody));
                return JsonSerializer.Deserialize<T>(responseBody, Json)!;
            }
        }
    }

    internal async IAsyncEnumerable<T> PaginateAsync<T>(Func<string?, Task<Page<T>>> list,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        string? cursor = null;
        do
        {
            cancellationToken.ThrowIfCancellationRequested();
            var page = await list(cursor).ConfigureAwait(false);
            foreach (var item in page.Data)
                yield return item;
            cursor = page.NextCursor;
        } while (!string.IsNullOrEmpty(cursor));
    }

    private static string QueryString(IEnumerable<KeyValuePair<string, string?>>? query) =>
        query is null
            ? ""
            : string.Join("&", query.Where(p => !string.IsNullOrEmpty(p.Value))
                .Select(p => Uri.EscapeDataString(p.Key) + "=" + Uri.EscapeDataString(p.Value!)));

    private static JsonElement Problem(byte[] body)
    {
        try
        {
            return body.Length == 0 ? default : JsonDocument.Parse(body).RootElement.Clone();
        }
        catch (JsonException)
        {
            return default;
        }
    }

    private static Task Delay(int attempt, CancellationToken cancellationToken) =>
        Task.Delay(TimeSpan.FromMilliseconds(Math.Min(500 * Math.Pow(2, attempt), 8000)), cancellationToken);

    /// <inheritdoc />
    public void Dispose()
    {
        if (_ownsHttp)
            _http.Dispose();
        if (_ownsKey)
            _key.Dispose();
    }
}
