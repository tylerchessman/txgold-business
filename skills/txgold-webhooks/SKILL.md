---
name: txgold-webhooks
description: Receive TxGold Business API webhooks - write the HTTPS endpoint that TxGold POSTs events to, verify the TxG-Webhook-Signature header (HMAC-SHA256 with the whsec_ secret), deduplicate by event id, and react to hold.held, hold.declined, hold.expired, payment_request.paid, payment_request.declined, payment_request.expired, payment.received and ping. Use this skill whenever code needs to learn that a TxGold customer approved a hold, paid a request or sent a payment without polling, or the user mentions TxGold webhooks, callbacks, notifications to their server, a webhook receiver/handler, or signature verification for TxGold - in Express, Flask, FastAPI, ASP.NET or any other framework. Read the txgold-business-api skill too for the API itself.
---

# Receiving TxGold webhooks

When something happens on a business's account that its own API calls didn't do (a customer
approves a hold, pays a request, sends a payment), TxGold POSTs an event to the business's HTTPS
endpoint within a few seconds. Webhooks replace polling; keep polling only as a fallback.

## Setting up an endpoint

1. Deploy a receiver at a public `https://` URL (below).
2. In the business portal (https://business.txgold.money) → **Webhooks**, add the URL and choose
   its events. An **Admin approves it on their phone**, like adding a key.
3. The portal shows the endpoint's **signing secret once** (`whsec_…`). Store it as a secret
   (environment variable, secrets manager); never in code or the repo.
4. "Send test" sends a `ping` event.

URL rules: `https://`, port 443, a public DNS name: no IP addresses, no `localhost`, nothing that
resolves to a private address (checked on every delivery). For local development, expose your
receiver through a tunnel that gives a public HTTPS URL. Redirects aren't followed.

## What arrives

```http
POST /txgold/webhooks
Content-Type: application/json
User-Agent: TxGold-Webhooks/1.0 (+https://docs.txgold.money/guides/webhooks)
TxG-Webhook-Id: evt_8812
TxG-Webhook-Signature: t=1795000000,v1=5257a869e7ec…

{"id":"evt_8812","type":"hold.held","createdAt":"2026-12-01T10:02:11Z","accountId":"1000007",
 "data":{"hold":{"id":"…","status":"held","amount":"150.00","heldUntil":"…","tag":"pump-4", …}}}
```

| `type` | When | `data` |
|---|---|---|
| `hold.held` | The customer approved a hold request | `hold` |
| `hold.declined` | The customer declined it | `hold` |
| `hold.expired` | Not approved in time, or held and never charged | `hold` |
| `payment_request.paid` | A request was paid, by any route | `paymentRequest`, `payment` |
| `payment_request.declined` | The payer dismissed it | `paymentRequest` |
| `payment_request.expired` | It reached `expiresAt` unpaid | `paymentRequest` |
| `payment.received` | Any payment arrived (including hold captures and QR-code payments) | `payment` |
| `ping` | "Send test" in the portal | `{}` |

- `data` holds the same objects the matching `GET` returns (`hold`, `paymentRequest`, `payment`),
  so one parser serves both.
- `data` is the resource **as it is when the delivery is sent**, not when the event happened: a
  late retry of `hold.held` may carry a hold that's since been captured. **Act on `data`'s
  `status`**, not on the event type alone.
- No events for what your own API calls did (create, capture, release, cancel, refund): you have
  those answers already.
- New event types and fields can appear: ignore what you don't know and still answer 2xx.

## Verifying the signature

`TxG-Webhook-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>." + raw body)>`

- The HMAC key is the **whole secret string** as UTF-8, `whsec_` included.
- The message is the decimal `t`, a `.`, then the **raw request body bytes**, exactly as received.
  Verify **before** parsing JSON; a framework that parses and re-serializes the body breaks it.
- There may be **several `v1=`** values (for 24 hours after a secret rotation, one per secret):
  accept if **any** matches. Compare in constant time.
- Refuse a `t` more than 5 minutes from now (replays).

Test vector: secret `whsec_test`, `t=1795000000`, body `{"id":"evt_1","type":"ping"}` →
`v1=48912461194e6cd5feb62cb75b4f70d8b5042e1b988ee0c3d23acfa5cc5820e5`. (Use a fixed "now" near
`t`, or skip the age check, when testing with it.)

### Node.js (Express)

```js
import crypto from 'node:crypto';
import express from 'express';

export function verifyTxGoldWebhook(rawBody, header, secret, toleranceSeconds = 300, now = Date.now() / 1000) {
  let t = null; const sigs = [];
  for (const part of (header ?? '').split(',')) {
    const i = part.indexOf('='); if (i <= 0) continue;
    const name = part.slice(0, i).trim(), value = part.slice(i + 1).trim();
    if (name === 't' && /^\d+$/.test(value)) t = Number(value); else if (name === 'v1') sigs.push(value);
  }
  if (t === null || Math.abs(now - t) > toleranceSeconds) return false;
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest('hex'));
  return sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), expected));
}

const app = express();
app.post('/txgold/webhooks', express.raw({ type: 'application/json' }), (req, res) => {
  if (!verifyTxGoldWebhook(req.body, req.get('TxG-Webhook-Signature'), process.env.TXGOLD_WEBHOOK_SECRET)) {
    return res.status(400).send('bad signature');
  }
  const event = JSON.parse(req.body.toString('utf8'));
  res.sendStatus(204);          // answer first, then work
  queueForProcessing(event);    // your own: dedupe on event.id, act on event.data's status
});
```

### Python (Flask)

```python
import hashlib, hmac, json, os, time
from flask import Flask, request

def verify_txgold_webhook(raw_body: bytes, header: str, secret: str, tolerance: int = 300, now: float = None) -> bool:
    t, sigs = None, []
    for part in (header or "").split(","):
        name, sep, value = part.partition("=")
        if not sep:
            continue
        name, value = name.strip(), value.strip()
        if name == "t" and value.isdigit():
            t = int(value)
        elif name == "v1":
            sigs.append(value)
    if t is None or abs((now if now is not None else time.time()) - t) > tolerance:
        return False
    expected = hmac.new(secret.encode("utf-8"), f"{t}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(s, expected) for s in sigs)

app = Flask(__name__)

@app.post("/txgold/webhooks")
def txgold_webhook():
    raw = request.get_data()  # the raw bytes, before any JSON parsing
    if not verify_txgold_webhook(raw, request.headers.get("TxG-Webhook-Signature", ""), os.environ["TXGOLD_WEBHOOK_SECRET"]):
        return "bad signature", 400
    enqueue(json.loads(raw))  # your own: dedupe on id, act on data's status
    return "", 204
```

### C# (ASP.NET Core minimal API)

```csharp
using System.Security.Cryptography;
using System.Text;

static bool VerifyTxGoldWebhook(byte[] body, string? header, string secret, TimeSpan? tolerance = null, DateTimeOffset? now = null)
{
    long? t = null; var sigs = new List<string>();
    foreach (var part in (header ?? "").Split(','))
    {
        int i = part.IndexOf('='); if (i <= 0) continue;
        string name = part[..i].Trim(), value = part[(i + 1)..].Trim();
        if (name == "t" && long.TryParse(value, out long parsed)) t = parsed; else if (name == "v1") sigs.Add(value);
    }
    long nowSeconds = (now ?? DateTimeOffset.UtcNow).ToUnixTimeSeconds();
    if (t is null || Math.Abs(nowSeconds - t.Value) > (tolerance ?? TimeSpan.FromMinutes(5)).TotalSeconds) return false;
    byte[] message = [.. Encoding.UTF8.GetBytes($"{t}."), .. body];
    byte[] expected = Encoding.ASCII.GetBytes(Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), message)).ToLowerInvariant());
    return sigs.Any(s => CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(s), expected));
}

app.MapPost("/txgold/webhooks", async (HttpRequest request) =>
{
    using var buffer = new MemoryStream();
    await request.Body.CopyToAsync(buffer);
    byte[] body = buffer.ToArray();
    if (!VerifyTxGoldWebhook(body, request.Headers["TxG-Webhook-Signature"], builder.Configuration["TxGold:WebhookSecret"]!))
        return Results.BadRequest();
    var evt = JsonDocument.Parse(body).RootElement.Clone();
    channel.Writer.TryWrite(evt);   // your own background queue: dedupe on id, act on data's status
    return Results.NoContent();
});
```

The SDKs will gain a `verifyWebhook` helper; until your SDK version has one, use these.

## Handling events well

- **Answer 2xx within 10 seconds**, before slow work: anything else (or no answer) is retried. Put
  the event on a queue or table and process it after responding.
- **At least once, in no particular order.** The same event can arrive twice (same `id` and
  `TxG-Webhook-Id` on every retry): store processed ids and skip repeats. Don't assume `hold.held`
  arrives before `payment.received`.
- **Act on state, not on the event name**: re-read `data.hold.status` (or `GET` it) and make each
  action idempotent: capturing a hold you already captured gives `hold_not_held`, which means done.
- **Retries:** after 10 s, 1 min, 5 min, 30 min, 2 h, 6 h, then every 12 h for 3 days; then the
  delivery is marked failed (the portal can resend it). An endpoint that fails everything for 3 days
  is disabled and the business's Admins get a push.
- **Keep a fallback:** if a webhook doesn't come when expected, `GET` the resource (a pump waiting
  for approval polls `GET /v1/holds/{id}` until `approveBy`).
- **Rotate secrets** in the portal: for 24 hours both secrets sign each delivery, so accept either
  while you deploy the new one.
- Return 400 for a bad signature and log it (without the secret).

## Testing

- Unit-test your verifier with the vector above, plus a changed body, a wrong secret, a stale `t`,
  and two `v1=` values.
- End to end: "Send test" (`ping`) from the portal; then make a real event happen, e.g. in the
  Sandbox create a hold and approve it with `POST /v1/sandbox/holds/{id}/approve` (see
  `txgold-holds`), and watch `hold.held` arrive.
