using System;
using System.IO;
using System.Security.Cryptography;
using System.Text.Json;

namespace TxGold.Business;

/// <summary>A P-256 private key and the TxG-Key-Id that names it.</summary>
public sealed class SigningKey : IDisposable
{
    private SigningKey(ECDsa privateKey, string keyId, string? environment, string? accountId)
    {
        PrivateKey = privateKey;
        KeyId = keyId;
        Environment = environment;
        AccountId = accountId;
    }

    /// <summary>The base64 SubjectPublicKeyInfo of the public key: the TxG-Key-Id header.</summary>
    public string KeyId { get; }

    /// <summary>The private key.</summary>
    public ECDsa PrivateKey { get; }

    /// <summary>From the key file, when it says: "sandbox" or "production".</summary>
    public string? Environment { get; }

    /// <summary>From the key file, when it says: the account the integration acts for.</summary>
    public string? AccountId { get; }

    /// <summary>
    /// Loads a key file from the business portal (txgold-&lt;environment&gt;-&lt;name&gt;.key.json). The
    /// private key may be <c>privateKeyPkcs8</c> (base64 PKCS#8 DER), <c>privateKeyPem</c> (PKCS#8
    /// "PRIVATE KEY" or SEC1 "EC PRIVATE KEY"), or <c>privateKey</c> (base64 SEC1 DER, older Sandbox files).
    /// </summary>
    public static SigningKey FromKeyFile(string path) => Parse(File.ReadAllText(path));

    /// <summary>Parses the text of a key file. See <see cref="FromKeyFile"/>.</summary>
    public static SigningKey Parse(string json)
    {
        JsonElement root;
        try
        {
            using var document = JsonDocument.Parse(json);
            root = document.RootElement.Clone();
        }
        catch (JsonException)
        {
            throw new FormatException("The key file is not valid JSON.");
        }
        if (root.ValueKind != JsonValueKind.Object)
            throw new FormatException("The key file is not valid JSON.");

        string? Text(string name) =>
            root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String && value.GetString() is { Length: > 0 } s ? s : null;

        var ecdsa = ECDsa.Create();
        try
        {
            if (Text("privateKeyPkcs8") is { } pkcs8)
                ecdsa.ImportPkcs8PrivateKey(Convert.FromBase64String(pkcs8), out _);
            else if (Text("privateKeyPem") is { } pem)
                ImportPem(ecdsa, pem);
            else if (Text("privateKey") is { } sec1)
                ecdsa.ImportECPrivateKey(Convert.FromBase64String(sec1), out _);
            else
                throw new FormatException("The key file has no private key (privateKeyPkcs8, privateKeyPem or privateKey).");

            var key = FromECDsa(ecdsa);
            if (Text("keyId") is { } keyId && keyId != key.KeyId)
                throw new FormatException("The key file's keyId does not match its private key.");

            string? accountId = root.TryGetProperty("accountId", out var account)
                ? account.ValueKind switch
                {
                    JsonValueKind.String => account.GetString(),
                    JsonValueKind.Number => account.GetRawText(),
                    _ => null,
                }
                : null;
            return new SigningKey(ecdsa, key.KeyId, Text("environment"), string.IsNullOrEmpty(accountId) ? null : accountId);
        }
        catch
        {
            ecdsa.Dispose();
            throw;
        }
    }

    /// <summary>Wraps a PKCS#8 ("PRIVATE KEY") or SEC1 ("EC PRIVATE KEY") PEM.</summary>
    public static SigningKey FromPem(string pem)
    {
        var ecdsa = ECDsa.Create();
        try
        {
            ImportPem(ecdsa, pem);
            return FromECDsa(ecdsa);
        }
        catch
        {
            ecdsa.Dispose();
            throw;
        }
    }

    /// <summary>Wraps a P-256 private key. The key is used as is, not copied.</summary>
    public static SigningKey FromECDsa(ECDsa privateKey)
    {
        var parameters = privateKey.ExportParameters(false);
        if (parameters.Curve.Oid?.Value != "1.2.840.10045.3.1.7" && parameters.Curve.Oid?.FriendlyName is not ("nistP256" or "ECDSA_P256"))
            throw new ArgumentException("TxGold keys are ECDSA P-256 (nistP256).", nameof(privateKey));
        string keyId = Convert.ToBase64String(privateKey.ExportSubjectPublicKeyInfo());
        return new SigningKey(privateKey, keyId, null, null);
    }

    private static void ImportPem(ECDsa ecdsa, string pem)
    {
        if (TryPemBody(pem, "PRIVATE KEY", out byte[] pkcs8))
            ecdsa.ImportPkcs8PrivateKey(pkcs8, out _);
        else if (TryPemBody(pem, "EC PRIVATE KEY", out byte[] sec1))
            ecdsa.ImportECPrivateKey(sec1, out _);
        else
            throw new FormatException("Expected a \"PRIVATE KEY\" or \"EC PRIVATE KEY\" PEM.");
    }

    // ImportFromPem is .NET 5+; this keeps netstandard2.1
    private static bool TryPemBody(string pem, string label, out byte[] der)
    {
        string begin = $"-----BEGIN {label}-----", end = $"-----END {label}-----";
        int start = pem.IndexOf(begin, StringComparison.Ordinal);
        int stop = start < 0 ? -1 : pem.IndexOf(end, start, StringComparison.Ordinal);
        if (start < 0 || stop < 0)
        {
            der = Array.Empty<byte>();
            return false;
        }
        string body = pem.Substring(start + begin.Length, stop - start - begin.Length);
        der = Convert.FromBase64String(string.Concat(body.Split(new[] { '\r', '\n', ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries)));
        return true;
    }

    /// <inheritdoc />
    public void Dispose() => PrivateKey.Dispose();
}
