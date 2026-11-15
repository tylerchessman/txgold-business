# Samples

Every sample runs against the Sandbox. Set three environment variables first:

- `TXGOLD_KEY_FILE`: your Sandbox key file from the business portal
- `TXGOLD_ACCOUNT_ID`: your business account
- `TXGOLD_CUSTOMER_ID`: one of its Sandbox demo customers

## The tour

The same tour of the API in each language: the rate, your balance (funding it with test TxGold
when low), a payment to a demo customer, a payment request that the demo customer pays, a refund,
and your latest transactions.

| Language | Run |
|---|---|
| JavaScript | `cd javascript && npm install && node tour.mjs` |
| Python | `cd python && pip install -r requirements.txt && python tour.py` |
| C# | `cd csharp/Tour && dotnet run` |

## Ways to get paid

One example per way of taking a payment, as described in
[Ways to get paid](https://docs.txgold.money/guides/ways-to-get-paid). In the Sandbox, a demo
customer stands in for the person paying.

| Example | Shows | JavaScript | Python | C# |
|---|---|---|---|---|
| account-link | Build a payment link and its QR yourself, with no API call | `account-link.mjs` | `account_link.py` | `AccountLink/` |
| checkout-handle | A website checkout: request by the customer's handle, poll, cancel on timeout. Set `TXGOLD_PAYER_HANDLE` | `checkout-handle.mjs` | `checkout_handle.py` | `CheckoutHandle/` |
| app-handoff | Open the TxGold app on an open request from your own app | `app-handoff.mjs` | `app_handoff.py` | `AppHandoff/` |
| invoice-link | An open request, its `paymentUrl` and a QR image, poll until paid | `invoice-link.mjs` | `invoice_link.py` | `InvoiceLink/` |
| till-qr | A new open request per sale at a counter, cancelled if the sale is abandoned | `till-qr.mjs` | `till_qr.py` | `TillQr/` |

These use SDK 0.2.0. Until it's published, install the SDK from this repository: see the
comments at the top of `javascript/README.md` and `python/requirements.txt`. The C# samples
reference the SDK project directly.

## The demo site

[`demo-site/`](demo-site) is the site at [demo.txgold.money](https://demo.txgold.money): all six
ways, live against the Sandbox, with a simulated customer phone and each API call shown as it
happens. It shows how to keep the key on a server while a web page drives the payment.
