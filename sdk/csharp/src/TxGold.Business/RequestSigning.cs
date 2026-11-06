using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading;

namespace TxGold.Business;

/// <summary>TXG1 request signing: the canonical string, ECDSA P-256 signatures and .NET-tick timestamps.</summary>
public static class RequestSigning
{
    /// <summary>The first line of every canonical string: the scheme and version.</summary>
    public const string Scheme = "TXG1-ECDSA-P256-SHA256";

    /// <summary>Lower-case hex SHA-256 of the exact body bytes (an empty body is the hash of nothing).</summary>
    public static string Sha256Hex(byte[] body)
    {
        using var sha = SHA256.Create();
        byte[] hash = sha.ComputeHash(body);
        var hex = new StringBuilder(hash.Length * 2);
        foreach (byte b in hash)
            hex.Append(b.ToString("x2"));
        return hex.ToString();
    }

    /// <summary>
    /// The string a request's signature covers:
    /// <c>TXG1-ECDSA-P256-SHA256\nMETHOD\nPATH\nQUERY\nTIMESTAMP\nhex(sha256(body))</c>.
    /// PATH and QUERY exactly as sent (QUERY without the "?", empty when there is none).
    /// </summary>
    public static string CanonicalString(string method, string path, string query, string timestamp, byte[] body) =>
        string.Join("\n", Scheme, method.ToUpperInvariant(), path, query, timestamp, Sha256Hex(body));

    /// <summary>Signs a canonical string: ECDSA P-256 with SHA-256, IEEE P1363 (r||s), base64.</summary>
    public static string Sign(ECDsa privateKey, string canonical) =>
        // .NET's default ECDSA signature format is IEEE P1363 on every platform
        Convert.ToBase64String(privateKey.SignData(Encoding.UTF8.GetBytes(canonical), HashAlgorithmName.SHA256));

    /// <summary>Checks a base64 IEEE P1363 signature over a canonical string.</summary>
    public static bool Verify(ECDsa publicKey, string canonical, string signatureBase64) =>
        publicKey.VerifyData(Encoding.UTF8.GetBytes(canonical), Convert.FromBase64String(signatureBase64), HashAlgorithmName.SHA256);

    /// <summary>UTC now as .NET ticks (100 ns since 0001-01-01), the TxG-Timestamp format.</summary>
    public static long TicksNow() => DateTime.UtcNow.Ticks;
}

/// <summary>
/// Hands out TxG-Timestamp values that never repeat within one client. The timestamp is also the
/// request's idempotency key, so two different payments signed at the same instant must not share one.
/// </summary>
public sealed class TimestampClock
{
    private long _last;

    /// <summary>The next timestamp: now, or one tick after the last one handed out.</summary>
    public string Next()
    {
        while (true)
        {
            long last = Interlocked.Read(ref _last);
            long next = Math.Max(RequestSigning.TicksNow(), last + 1);
            if (Interlocked.CompareExchange(ref _last, next, last) == last)
                return next.ToString(System.Globalization.CultureInfo.InvariantCulture);
        }
    }
}
