# Demo site

The site at [demo.txgold.money](https://demo.txgold.money): the six
[ways to get paid](https://docs.txgold.money/guides/ways-to-get-paid), each from both sides, live
against the Sandbox. It is also the most complete sample here: a web page that never holds a key,
and a small server that does.

| Part | What it is |
|---|---|
| `src/` | The page: Vite, React, Tailwind. The business on the left, a simulated TxGold phone in the middle, and on the right each Business API call of the run and the sample code behind the current step |
| `api/` | The server: Azure Functions (Node) using `@txgold/business`. It holds the Sandbox key, signs every call, and records each exchange for the page |
| `public/staticwebapp.config.json` | Static Web Apps routing and security headers |

The code panels show the JavaScript samples in `../javascript` themselves, so the demo shows the
code you would copy.

## What's real

- Payment requests, polling, cancelling and transactions are real Sandbox API calls.
- The customer's phone is simulated. Approve calls `POST /v1/sandbox/payment-requests/{id}/pay`,
  which pays as a demo customer would in the app.
- Ways 1 and 2 pay an account directly, with no request. The Sandbox can't simulate that, so the
  payment is shown, not made.
- The QR codes open the demo's own phone page, `/pay/{id}`, not the request's `paymentUrl`. A
  real phone can scan them and pay there. In production the QR holds `paymentUrl`, which opens the
  real TxGold app.

## How it keeps the key safe

The browser never chooses an account, a payer id or an API path. It asks `api/` for one of a
fixed set of request shapes:

- the amount is capped (5.00);
- the payer is one of the demo's own customers;
- requests expire in 10 to 15 minutes.

Each visitor gets a signed session. Every request it makes is tagged `demo-<session>`, and `api/`
acts only on requests carrying the caller's tag. Rate limits apply per IP and per session.

| Route | Does |
|---|---|
| `GET /api/config` | The demo business and its demo customers' handles |
| `POST /api/session` | A signed session token, sent back in `X-Demo-Session` |
| `POST /api/requests` | Creates a request: `{ method, amount, memo?, customer?, handle? }`, `method` one of `app-request`, `web-checkout`, `in-app`, `till`, `invoice` |
| `GET /api/requests/{id}` | The request, if it's this session's |
| `POST /api/requests/{id}/pay` | Sandbox pay, as demo customer `customer` for an open request |
| `POST /api/requests/{id}/cancel` | Cancels it; if it was paid meanwhile, returns it paid |
| `GET /api/transactions` | The demo business's latest transactions |

Every response carries `exchanges`: the Business API calls it made, with the signature shortened.

## Run it yourself

You need Node 20 or later, [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) 4, and a Sandbox business with
demo customers. The key file is the one from the business portal.

1. Copy `api/local.settings.example.json` to `api/local.settings.json`, which git ignores. Fill it
   in:
   - `TXGOLD_KEY_FILE`: the key file's path.
   - `TXGOLD_ACCOUNT_ID`: your business account.
   - `DEMO_CUSTOMERS`: your demo customers, as `id:handle`, comma-separated.
   - `DEMO_SESSION_SECRET`: any 32 or more random characters.
2. Start the API:
   ```sh
   cd api && npm install && npm start
   ```
   It runs on port 7071. Until `@txgold/business` 0.2.0 is on npm, run
   `npm install --no-save <path to a packed SDK .tgz>` instead of `npm install`. The packed file
   comes from `npm pack` in `sdk/javascript`.
3. Start the page, in another terminal:
   ```sh
   npm install && npm run dev
   ```
   Open the URL it prints. It forwards `/api` to port 7071.

Tests:
- the page: `npm test`;
- the API: `cd api && npm test`, which uses a fake Business API and needs no key.

## Deploying

`.github/workflows/demo-site.yml` tests and builds the site, then deploys it to the Static Web App,
including the API with the SDK from this repository. The deploy needs:

- **Repository secret** `AZURE_STATIC_WEB_APPS_API_TOKEN_DEMO`: the Static Web App's deployment
  token.
- **Static Web App application settings:**
  - `TXGOLD_KEY`: the key file's JSON.
  - `TXGOLD_ACCOUNT_ID`, `DEMO_CUSTOMERS` and `DEMO_SESSION_SECRET`, as above.

Sandbox only: the API refuses to start with a key whose file says it's for production.
