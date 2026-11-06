using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TxGold.Business;

// The API's resources. Amounts are decimal (sent and received as strings such as "12.50", never as
// JSON numbers), ids are strings, and times are UTC.

/// <summary>A page of a list. Pass <see cref="NextCursor"/> as the cursor for the next page; null on the last.</summary>
public sealed record Page<T>(IReadOnlyList<T> Data, string? NextCursor);

/// <summary>An account your key acts for.</summary>
public sealed record Account(string Id, string? AccountName, string? DisplayName, string Type, int? Tier, bool Active,
    [property: JsonConverter(typeof(NullableMoneyConverter))] decimal? Balance);

/// <summary>A business or charity found by its handle.</summary>
public sealed record AccountLookup(string Id, string AccountName, string? DisplayName, string Type);

/// <summary>The other side of a transaction.</summary>
public sealed record Counterparty(string AccountId, string? AccountName, string? DisplayName, string? Type);

/// <summary>One line of an account's history.</summary>
public sealed record AccountTransaction(
    string Id,
    string Direction,
    [property: JsonConverter(typeof(MoneyConverter))] decimal Amount,
    [property: JsonConverter(typeof(NullableMoneyConverter))] decimal? Fee,
    Counterparty? Counterparty,
    string? Memo,
    string? MemoInternal,
    DateTimeOffset CreatedAt,
    string? PaymentRequestId,
    string? RefundOf,
    string? RefundId,
    [property: JsonConverter(typeof(NullableMoneyConverter))] decimal? BalanceAfter,
    [property: JsonConverter(typeof(NullableMoneyConverter))] decimal? EstimatedUsdValue,
    [property: JsonConverter(typeof(NullableMoneyConverter))] decimal? ActualUsdValue);

/// <summary>A payment, seen from one side.</summary>
public sealed record Payment(
    string Id,
    string AccountId,
    string DestinationAccountId,
    string Direction,
    [property: JsonConverter(typeof(MoneyConverter))] decimal Amount,
    [property: JsonConverter(typeof(NullableMoneyConverter))] decimal? Fee,
    string? Memo,
    string? MemoInternal,
    DateTimeOffset CreatedAt,
    string? PaymentRequestId,
    string? RefundOf,
    string? RefundId,
    [property: JsonConverter(typeof(NullableMoneyConverter))] decimal? RefundedAmount,
    [property: JsonConverter(typeof(NullableMoneyConverter))] decimal? BalanceAfter);

/// <summary>A request for a payment from another account.</summary>
public sealed record PaymentRequest(
    string Id,
    string Status,
    string AccountId,
    string PayerAccountId,
    [property: JsonConverter(typeof(MoneyConverter))] decimal Amount,
    string? Memo,
    string? MemoInternal,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? StatusChangedAt,
    string? PaymentId);

/// <summary>The TxGold rate.</summary>
public sealed record Rate(
    [property: JsonConverter(typeof(MoneyConverter))] decimal UsdPerTxGold,
    [property: JsonConverter(typeof(MoneyConverter))] decimal UsdPerTroyOunce,
    DateTimeOffset AsOf);

/// <summary>A payment to send.</summary>
public sealed class PaymentCreate
{
    /// <summary>The account paying: one your key acts for.</summary>
    public required string AccountId { get; init; }

    /// <summary>Required unless <see cref="PaymentRequestId"/> is given.</summary>
    public string? DestinationAccountId { get; init; }

    /// <summary>At most 2 decimal places.</summary>
    [JsonConverter(typeof(MoneyConverter))]
    public required decimal Amount { get; init; }

    /// <summary>Shown to both sides; up to 150 characters.</summary>
    public string? Memo { get; init; }

    /// <summary>Your own reference, shown only to you; up to 150 characters.</summary>
    public string? MemoInternal { get; init; }

    /// <summary>Pays this payment request; the amount must match it.</summary>
    public string? PaymentRequestId { get; init; }
}

/// <summary>A refund of a payment your account received.</summary>
public sealed class RefundCreate
{
    /// <summary>At most what was paid; null refunds the whole payment.</summary>
    [JsonConverter(typeof(NullableMoneyConverter))]
    public decimal? Amount { get; init; }

    /// <summary>Shown to both sides.</summary>
    public string? Memo { get; init; }

    /// <summary>Your own reference.</summary>
    public string? MemoInternal { get; init; }
}

/// <summary>A payment request to send.</summary>
public sealed class PaymentRequestCreate
{
    /// <summary>Your account, which will be paid.</summary>
    public required string AccountId { get; init; }

    /// <summary>The account asked to pay.</summary>
    public required string PayerAccountId { get; init; }

    /// <summary>At most 2 decimal places.</summary>
    [JsonConverter(typeof(MoneyConverter))]
    public required decimal Amount { get; init; }

    /// <summary>Shown to the payer.</summary>
    public string? Memo { get; init; }

    /// <summary>Your own reference.</summary>
    public string? MemoInternal { get; init; }

    /// <summary>At most 7 days ahead; the API's default when null.</summary>
    public DateTimeOffset? ExpiresAt { get; init; }
}

/// <summary>Money on the wire: a decimal string such as "12.50", never a JSON number.</summary>
public sealed class MoneyConverter : JsonConverter<decimal>
{
    /// <inheritdoc />
    public override decimal Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.String
            && decimal.TryParse(reader.GetString(), NumberStyles.AllowDecimalPoint | NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out decimal value))
            return value;
        if (reader.TokenType == JsonTokenType.Number)
            return reader.GetDecimal();
        throw new JsonException("Expected an amount as a decimal string.");
    }

    /// <inheritdoc />
    public override void Write(Utf8JsonWriter writer, decimal value, JsonSerializerOptions options)
    {
        if (decimal.Round(value, 2) != value)
            throw new ArgumentException($"Amounts have at most 2 decimal places: {value.ToString(CultureInfo.InvariantCulture)}");
        writer.WriteStringValue(value.ToString("0.00", CultureInfo.InvariantCulture));
    }
}

/// <summary><see cref="MoneyConverter"/> for <c>decimal?</c>.</summary>
public sealed class NullableMoneyConverter : JsonConverter<decimal?>
{
    private static readonly MoneyConverter Inner = new();

    /// <inheritdoc />
    public override decimal? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.TokenType == JsonTokenType.Null ? null : Inner.Read(ref reader, typeof(decimal), options);

    /// <inheritdoc />
    public override void Write(Utf8JsonWriter writer, decimal? value, JsonSerializerOptions options)
    {
        if (value is null)
            writer.WriteNullValue();
        else
            Inner.Write(writer, value.Value, options);
    }
}
