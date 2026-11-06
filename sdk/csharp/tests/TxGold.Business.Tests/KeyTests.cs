using System.Security.Cryptography;
using System.Text.Json;

namespace TxGold.Business.Tests;

public class KeyTests
{
    private static (ECDsa Key, string KeyId) Pair()
    {
        var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        return (key, Convert.ToBase64String(key.ExportSubjectPublicKeyInfo()));
    }

    [Fact]
    public void Portal_key_file()
    {
        var (key, keyId) = Pair();
        string json = JsonSerializer.Serialize(new
        {
            keyId,
            privateKeyPkcs8 = Convert.ToBase64String(key.ExportPkcs8PrivateKey()),
            privateKeyPem = key.ExportPkcs8PrivateKeyPem(),
            environment = "sandbox",
            accountId = "1000002",
        });
        using var loaded = SigningKey.Parse(json);
        Assert.Equal((keyId, "sandbox", "1000002"), (loaded.KeyId, loaded.Environment, loaded.AccountId));
    }

    [Fact]
    public void Pem_only_PKCS8_and_SEC1()
    {
        var (key, keyId) = Pair();
        foreach (string pem in new[] { key.ExportPkcs8PrivateKeyPem(), key.ExportECPrivateKeyPem() })
        {
            using var loaded = SigningKey.Parse(JsonSerializer.Serialize(new { keyId, privateKeyPem = pem }));
            Assert.Equal(keyId, loaded.KeyId);
            using var fromPem = SigningKey.FromPem(pem);
            Assert.Equal(keyId, fromPem.KeyId);
        }
    }

    [Fact]
    public void Older_Sandbox_file_SEC1_DER()
    {
        var (key, keyId) = Pair();
        using var loaded = SigningKey.Parse(JsonSerializer.Serialize(new { keyId, privateKey = Convert.ToBase64String(key.ExportECPrivateKey()) }));
        Assert.Equal(keyId, loaded.KeyId);
    }

    [Fact]
    public void Mismatched_keyId_is_refused()
    {
        var (key, _) = Pair();
        var (_, otherId) = Pair();
        var error = Assert.Throws<FormatException>(() => SigningKey.Parse(JsonSerializer.Serialize(new { keyId = otherId, privateKeyPem = key.ExportPkcs8PrivateKeyPem() })));
        Assert.Contains("does not match", error.Message);
    }

    [Fact]
    public void Bad_files_and_curves_are_refused()
    {
        Assert.Contains("no private key", Assert.Throws<FormatException>(() => SigningKey.Parse("{\"keyId\":\"x\"}")).Message);
        Assert.Contains("not valid JSON", Assert.Throws<FormatException>(() => SigningKey.Parse("not json")).Message);
        using var p384 = ECDsa.Create(ECCurve.NamedCurves.nistP384);
        Assert.Throws<ArgumentException>(() => SigningKey.FromECDsa(p384));
    }
}
