using System;
using System.Collections.Generic;
using System.Text.Json;

namespace TxGold.Business;

/// <summary>
/// An error response from the API (application/problem+json). <see cref="Code"/> is the stable,
/// documented value to branch on; see https://docs.txgold.money/errors/{code}.
/// </summary>
public sealed class TxGoldApiException : Exception
{
    /// <summary>Creates one from a status and a parsed problem+json body (or an empty object).</summary>
    public TxGoldApiException(int status, JsonElement problem)
        : base(Describe(status, problem))
    {
        Status = status;
        Code = Text(problem, "code") ?? $"http_{status}";
        Title = Text(problem, "title") ?? $"HTTP {status}";
        Detail = Text(problem, "detail");
        RequestId = Text(problem, "requestId");
        Type = Text(problem, "type");
        if (problem.ValueKind == JsonValueKind.Object && problem.TryGetProperty("errors", out var errors) && errors.ValueKind == JsonValueKind.Object)
        {
            var map = new Dictionary<string, string[]>();
            foreach (var field in errors.EnumerateObject())
                if (field.Value.ValueKind == JsonValueKind.Array)
                    map[field.Name] = Array.ConvertAll(ToArray(field.Value), e => e.ValueKind == JsonValueKind.String ? e.GetString()! : e.GetRawText());
            Errors = map;
        }
    }

    /// <summary>The HTTP status.</summary>
    public int Status { get; }

    /// <summary>The error code, such as <c>insufficient_balance</c>.</summary>
    public string Code { get; }

    /// <summary>A short, human summary.</summary>
    public string Title { get; }

    /// <summary>What went wrong with this request, when the API says.</summary>
    public string? Detail { get; }

    /// <summary>Quote this to TxGold support.</summary>
    public string? RequestId { get; }

    /// <summary>The documentation URL for the code.</summary>
    public string? Type { get; }

    /// <summary>Field-level problems for invalid_request: field name to messages.</summary>
    public IReadOnlyDictionary<string, string[]>? Errors { get; }

    private static string? Text(JsonElement problem, string name) =>
        problem.ValueKind == JsonValueKind.Object && problem.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static string Describe(int status, JsonElement problem)
    {
        string code = Text(problem, "code") ?? $"http_{status}";
        string title = Text(problem, "title") ?? $"HTTP {status}";
        string? detail = Text(problem, "detail");
        return detail is null ? $"{title} ({code})" : $"{title} ({code}): {detail}";
    }

    private static JsonElement[] ToArray(JsonElement array)
    {
        var items = new List<JsonElement>();
        foreach (var item in array.EnumerateArray())
            items.Add(item);
        return items.ToArray();
    }
}
