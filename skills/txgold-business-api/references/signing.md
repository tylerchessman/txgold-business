# Signing requests by hand (TXG1-ECDSA-P256-SHA256)

Use this when there is no SDK for the language, the SDK can't be installed, or you are debugging
`invalid_signature`. The SDKs do exactly this.

## Contents
- The headers
- The canonical string
- Code: Node.js, Python, C# (other languages: follow the same steps and check against the vectors)
- Check your code against the test vectors
- Debugging `invalid_signature`

## The headers

| Header | Value |
|---|---|
| `TxG-Key-Id` | The key file's `keyId`: the public key as base64 SubjectPublicKeyInfo |
| `TxG-Timestamp` | Now, in UTC .NET ticks: `unix_milliseconds * 10000 + 621355968000000000`, as a decimal string |
| `TxG-Signature` | base64 ECDSA P-256 / SHA-256 signature of the canonical string, IEEE P1363 (64 bytes, r‖s) or DER |

Send `Content-Type: application/json` with a body. The private key is the key file's
`privateKeyPkcs8` (base64 DER) or `privateKeyPem`; both are the same PKCS#8 key.

## The canonical string

Six lines joined by `\n`, no trailing newline:

```
TXG1-ECDSA-P256-SHA256
METHOD            upper case: GET, POST
PATH              exactly as sent, e.g. /v1/holds/123/capture
QUERY             exactly as sent, without the "?"; an empty line when there is none
TIMESTAMP         the TxG-Timestamp value
BODYHASH          lower-case hex SHA-256 of the exact body bytes sent
```

- Serialize the JSON body **once** to UTF-8 bytes, hash those bytes, and send **those same bytes**.
  Re-serializing after signing (an HTTP library re-encoding a dict, a pretty-printer) breaks the
  signature. With no body, hash zero bytes:
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- Build the query string yourself, sign it, and append it to the URL unchanged.
- Each timestamp must be unique per request (two requests in the same tick: add 1). A repeated
  timestamp with the same body is treated as a retry of the first.

## Node.js (no dependencies)

```js
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const keyFile = JSON.parse(readFileSync(process.env.TXGOLD_KEY_FILE, 'utf8'));
const privateKey = createPrivateKey({ key: Buffer.from(keyFile.privateKeyPkcs8, 'base64'), format: 'der', type: 'pkcs8' });

let lastTicks = 0n;
function ticksNow() {
  const t = BigInt(Date.now()) * 10000n + 621355968000000000n;
  lastTicks = t > lastTicks ? t : lastTicks + 1n;
  return lastTicks.toString();
}

export async function txgold(baseUrl, method, path, { query = '', body, timestamp = ticksNow() } = {}) {
  const bytes = body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body), 'utf8');
  const canonical = ['TXG1-ECDSA-P256-SHA256', method.toUpperCase(), path, query, timestamp,
    createHash('sha256').update(bytes).digest('hex')].join('\n');
  const signature = sign('sha256', Buffer.from(canonical, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64');
  const res = await fetch(`${baseUrl}${path}${query ? `?${query}` : ''}`, {
    method,
    headers: {
      'TxG-Key-Id': keyFile.keyId, 'TxG-Timestamp': timestamp, 'TxG-Signature': signature,
      Accept: 'application/json', ...(bytes.length ? { 'Content-Type': 'application/json' } : {}),
    },
    body: bytes.length ? bytes : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw Object.assign(new Error(`${json?.code}: ${json?.detail}`), { status: res.status, problem: json });
  return json;
}
```

## Python (`pip install cryptography httpx`)

```python
import base64, hashlib, json, os, threading, time
import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

key_file = json.load(open(os.environ["TXGOLD_KEY_FILE"], encoding="utf-8"))
private_key = serialization.load_der_private_key(base64.b64decode(key_file["privateKeyPkcs8"]), password=None)
_last, _lock = 0, threading.Lock()

def ticks_now() -> str:
    global _last
    with _lock:
        t = time.time_ns() // 100 + 621355968000000000
        _last = t if t > _last else _last + 1
        return str(_last)

def txgold(base_url, method, path, *, query="", body=None, timestamp=None):
    content = b"" if body is None else json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    timestamp = timestamp or ticks_now()
    canonical = "\n".join(["TXG1-ECDSA-P256-SHA256", method.upper(), path, query, timestamp,
                           hashlib.sha256(content).hexdigest()])
    r, s = decode_dss_signature(private_key.sign(canonical.encode("utf-8"), ec.ECDSA(hashes.SHA256())))
    signature = base64.b64encode(r.to_bytes(32, "big") + s.to_bytes(32, "big")).decode()
    headers = {"TxG-Key-Id": key_file["keyId"], "TxG-Timestamp": timestamp, "TxG-Signature": signature,
               "Accept": "application/json"}
    if content:
        headers["Content-Type"] = "application/json"
    resp = httpx.request(method, base_url + path + (f"?{query}" if query else ""), headers=headers, content=content or None)
    data = resp.json() if resp.content else None
    if resp.is_error:
        raise RuntimeError(f"{resp.status_code} {data.get('code')}: {data.get('detail')} (requestId {data.get('requestId')})")
    return data
```

## C# (.NET 8, no packages)

```csharp
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

var keyFile = JsonDocument.Parse(File.ReadAllText(Environment.GetEnvironmentVariable("TXGOLD_KEY_FILE")!)).RootElement;
using var ecdsa = ECDsa.Create();
ecdsa.ImportPkcs8PrivateKey(Convert.FromBase64String(keyFile.GetProperty("privateKeyPkcs8").GetString()!), out _);
string keyId = keyFile.GetProperty("keyId").GetString()!;
long lastTicks = 0;

string TicksNow() { long t = DateTime.UtcNow.Ticks; lastTicks = t > lastTicks ? t : lastTicks + 1; return lastTicks.ToString(); }

async Task<JsonElement?> TxGold(HttpClient http, string baseUrl, HttpMethod method, string path, string query = "", object? body = null, string? timestamp = null)
{
    byte[] bytes = body == null ? [] : JsonSerializer.SerializeToUtf8Bytes(body);
    timestamp ??= TicksNow();
    string canonical = string.Join('\n', "TXG1-ECDSA-P256-SHA256", method.Method.ToUpperInvariant(), path, query, timestamp,
        Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant());
    // .NET's default ECDSA signature format is IEEE P1363, which the API accepts
    string signature = Convert.ToBase64String(ecdsa.SignData(Encoding.UTF8.GetBytes(canonical), HashAlgorithmName.SHA256));
    using var request = new HttpRequestMessage(method, baseUrl + path + (query.Length > 0 ? "?" + query : ""));
    request.Headers.Add("TxG-Key-Id", keyId);
    request.Headers.Add("TxG-Timestamp", timestamp);
    request.Headers.Add("TxG-Signature", signature);
    if (bytes.Length > 0)
        request.Content = new ByteArrayContent(bytes) { Headers = { ContentType = new("application/json") } };
    using var response = await http.SendAsync(request);
    string text = await response.Content.ReadAsStringAsync();
    if (!response.IsSuccessStatusCode) throw new HttpRequestException($"{(int)response.StatusCode}: {text}");
    return text.Length == 0 ? null : JsonDocument.Parse(text).RootElement.Clone();
}
```

`DateTime.UtcNow.Ticks` is already .NET ticks. Use camelCase property names in the object you
serialize (anonymous types with lower-case names, or `JsonNamingPolicy.CamelCase`): unknown or
mis-cased fields are refused.

## Check your code against the test vectors

`vectors/v1-request-signing.json` in https://github.com/tylerchessman/txgold-business has cases
with the method, path, query, timestamp, body, its hash, the exact canonical string, and two
signatures (P1363 and DER) made with a key whose public half is `publicKeySpkiBase64`. Your code is
right when, for each case, it builds the identical canonical string and both signatures verify
against that public key. Your own signatures differ in bytes every time (ECDSA is randomized) and
still verify.

The first case, for a quick check: method `POST`, path `/v1/payments`, timestamp
`639283104000000000`, body
`{"accountId":"1000007","destinationAccountId":"1000006","amount":"0.50","memo":"Café ☕ – é"}`
(UTF-8), body hash `f0b032578179c4da1391de7762c614bc6b59d4f3fcc1eab2960baebcc9f062a0`.

## Debugging `invalid_signature`

The 401's `detail` contains the canonical string the server built from what it received. Compare
it line by line with the one you signed:

| Line differs | Usual cause |
|---|---|
| PATH | Signed a different path than requested: a base URL with a path prefix, a trailing slash, URL-encoding |
| QUERY | Parameters reordered or re-encoded by the HTTP library after signing |
| BODYHASH | Body re-serialized after signing (dict passed to the library instead of bytes), different spacing, non-UTF-8 |
| TIMESTAMP | Header sent differs from the one signed |

`key_not_found` instead means the server doesn't know the key: wrong environment (a Sandbox key
against production), or the key was revoked.
