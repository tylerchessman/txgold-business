using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace TxGold.Business.Tests;

/// <summary>
/// The shared signing vectors (vectors/v1-request-signing.json at the repo root). Every TxGold SDK
/// must pass these: build each canonical string exactly, and verify the reference signatures.
/// </summary>
public class VectorTests
{
    private static readonly JsonElement Vectors =
        JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "v1-request-signing.json"))).RootElement;

    public static TheoryData<string> Cases()
    {
        var data = new TheoryData<string>();
        foreach (var c in Vectors.GetProperty("cases").EnumerateArray())
            data.Add(c.GetProperty("name").GetString()!);
        return data;
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void Body_hash_and_canonical_string(string name)
    {
        var c = Case(name);
        byte[] body = Convert.FromBase64String(c.GetProperty("bodyBase64").GetString()!);
        Assert.Equal(c.GetProperty("bodySha256Hex").GetString(), RequestSigning.Sha256Hex(body));
        Assert.Equal(c.GetProperty("canonical").GetString(), RequestSigning.CanonicalString(
            c.GetProperty("method").GetString()!, c.GetProperty("path").GetString()!, c.GetProperty("query").GetString()!,
            c.GetProperty("timestamp").GetString()!, body));
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void Reference_signatures_verify_in_both_encodings(string name)
    {
        var c = Case(name);
        string canonical = c.GetProperty("canonical").GetString()!;
        using var key = PublicKey();
        byte[] data = Encoding.UTF8.GetBytes(canonical);
        Assert.True(RequestSigning.Verify(key, canonical, c.GetProperty("signatureP1363Base64").GetString()!));
        Assert.True(key.VerifyData(data, Convert.FromBase64String(c.GetProperty("signatureDerBase64").GetString()!),
            HashAlgorithmName.SHA256, DSASignatureFormat.Rfc3279DerSequence));
        Assert.False(RequestSigning.Verify(key, canonical + "x", c.GetProperty("signatureP1363Base64").GetString()!));
    }

    [Fact]
    public void Own_signatures_are_64_byte_P1363()
    {
        using var ecdsa = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        string canonical = Vectors.GetProperty("cases")[0].GetProperty("canonical").GetString()!;
        string signature = RequestSigning.Sign(ecdsa, canonical);
        Assert.Equal(64, Convert.FromBase64String(signature).Length);
        Assert.True(RequestSigning.Verify(ecdsa, canonical, signature));
    }

    [Fact]
    public void Timestamps_never_repeat()
    {
        var clock = new TimestampClock();
        var seen = new System.Collections.Concurrent.ConcurrentBag<string>();
        Parallel.For(0, 1000, _ => seen.Add(clock.Next()));
        Assert.Equal(1000, seen.Distinct().Count());
    }

    private static JsonElement Case(string name) =>
        Vectors.GetProperty("cases").EnumerateArray().Single(c => c.GetProperty("name").GetString() == name);

    private static ECDsa PublicKey()
    {
        var key = ECDsa.Create();
        key.ImportSubjectPublicKeyInfo(Convert.FromBase64String(Vectors.GetProperty("publicKeySpkiBase64").GetString()!), out _);
        return key;
    }
}
