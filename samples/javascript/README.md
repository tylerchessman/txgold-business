# JavaScript samples

Node.js 18.17 or later. `npm install`, set the environment variables named at the top of each file, then `node <file>`.

| File | Shows |
|---|---|
| `tour.mjs` | A tour: rate, balance, a payment, a request a demo customer pays, a refund, transactions |
| `checkout-handle.mjs` | Website checkout: a request to the customer's TxGold handle, polled until paid, cancelled on timeout |
| `invoice-link.mjs` | An open request for an invoice: its `paymentUrl` and a QR code (`invoice-qr.svg`, `invoice-qr.png`) |
| `till-qr.mjs` | A till: a fresh open request per sale, shown as a QR, cancelled if the sale is abandoned |
| `app-handoff.mjs` | Your app opens an open request's `paymentUrl`, so the TxGold app opens on it |
| `account-link.mjs` | No API call: a link and QR that open the TxGold app ready to pay your account |

In the Sandbox the samples have a demo customer pay, with `POST /v1/sandbox/payment-requests/{id}/pay`. In production the customer pays in the TxGold app.

## Before @txgold/business 0.2.0 is on npm

All but `tour.mjs` need 0.2.0 or later. To run them against the SDK in this repo:

```sh
cd ../../sdk/javascript && npm install && npm run build && cd -
npm install --no-save ../../sdk/javascript
```

That installs the other dependencies too, and `--no-save` leaves `package.json` pointing at the published package.
