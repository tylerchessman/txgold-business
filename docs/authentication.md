# Authentication

There are no API keys to send and no passwords. Each request is **signed** with your
integration's private key, and TxGold checks the signature with the public key it holds.
TxGold never sees the private key.

The SDKs do all of this. Read on if you're signing in another language, or debugging.

## Integrations and keys

An **integration** is a non-person user of your business account, created in the business portal
by an Admin. It has:

- a **role**:

  | Role | Send payments | Refund | Payment requests | See the balance |
  |---|---|---|---|---|
  | **Integration** | yes | yes | yes | yes |
  | **Device** (a till) | no | yes | yes | no |
  | **Device, no refunds** | no | no | no | no |

- one or more **keys**: ECDSA P-256 key pairs, each with a name and an **expiry** you choose when
  you add it, from one day to two years. A key works until it expires or an Admin revokes it.

Creating an integration, adding a key, or raising a role must be **approved by an Admin on their
phone** in the TxGold app, so a stolen browser session alone can't create a key that pays. Lowering
a role or revoking a key takes effect at once.

**Rotate keys without downtime:** add the new key, deploy it, then revoke the old one.

Sandbox and Production are separate: a Sandbox key is unknown to Production, and the other way
round.

## Key files

The portal saves a key as `txgold-<environment>-<name>.key.json`:

```json
{
  "keyId": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE…",
  "privateKeyPkcs8": "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0w…",
  "privateKeyPem": "-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n",
  "environment": "sandbox",
  "accountId": "1000002",
  "integration": "Checkout",
  "keyName": "web-1",
  "expiresAt": "2028-11-06T00:00:00.000Z",
  "createdAt": "2026-11-06T17:00:00.000Z"
}
```

- `keyId` is the base64 **SubjectPublicKeyInfo** of the public key. It's what goes in `TxG-Key-Id`.
- `privateKeyPkcs8` and `privateKeyPem` are the same private key in two encodings (PKCS#8).

Store the file the way you store any secret: a secrets manager or a locked-down file, never in
source control, never in a browser or mobile app.

To keep the private key off TxGold's portal entirely, generate the key pair yourself and paste only
the public key into the portal:

```bash
openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt -out private.pem
openssl pkey -in private.pem -pubout -out public.pem
```

## Signing a request

Every request carries three headers:

| Header | Value |
|---|---|
| `TxG-Key-Id` | The key's base64 SubjectPublicKeyInfo (`keyId` in the key file) |
| `TxG-Timestamp` | The current UTC time in .NET ticks: 100-nanosecond intervals since 0001-01-01. |
| `TxG-Signature` | The base64 ECDSA P-256 SHA-256 signature of the canonical string, as IEEE P1363 (64 bytes, r‖s) or DER |

The **canonical string** is six lines joined by `\n`, with no trailing newline:

```
TXG1-ECDSA-P256-SHA256
METHOD
PATH
QUERY
TIMESTAMP
hex(SHA-256(body bytes))
```

- `METHOD` in upper case. `PATH` and `QUERY` exactly as sent, with `QUERY` lacking its `?` and
  empty when there is none.
- The hash is over the **exact bytes of the body you send**, as lower-case hex. An empty body
  hashes to `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- Don't re-serialize the JSON after signing it. Serialize once, sign those bytes, send those bytes.

Ticks from Unix time: `ticks = unix_milliseconds × 10000 + 621355968000000000`.

### A worked example

The SDKs are tested against shared [test vectors](/vectors/v1-request-signing.json). This is the
first one, a payment whose memo has non-ASCII characters:

```http
POST /v1/payments
TxG-Timestamp: 639283104000000000
Content-Type: application/json

{"accountId":"1000007","destinationAccountId":"1000006","amount":"0.50","memo":"Café ☕ – é"}
```

Its body hashes to `f0b032578179c4da1391de7762c614bc6b59d4f3fcc1eab2960baebcc9f062a0`, so the
canonical string is:

```
TXG1-ECDSA-P256-SHA256
POST
/v1/payments

639283104000000000
f0b032578179c4da1391de7762c614bc6b59d4f3fcc1eab2960baebcc9f062a0
```

(The fourth line is the empty query.) The vectors file has the public key and two signatures of
this string, one in each encoding. Your code is right when it builds the same string and those
signatures verify against it. ECDSA signatures are randomized, so yours will differ in bytes but
still verify.

## Timestamps

`TxG-Timestamp` must be no more than **3 minutes ahead** of TxGold's clock and no more than **7
minutes behind** it; otherwise the request gets `timestamp_out_of_range`. Keep your servers on NTP.

The timestamp is also the request's **idempotency key**: see
[Idempotency and retries](/guides/idempotency).

## When a signature fails

`invalid_signature` responses carry, in `detail`, the canonical string TxGold verified, with each
newline written as `
`. Compare it with the one you signed: the line that differs is the bug.
