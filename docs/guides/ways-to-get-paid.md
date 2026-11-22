# Ways to get paid

Six ways for customers to pay your business in TxGold, from the simplest to the most
integrated. The first three need no code at all. Each section covers who it's for, what the payer
does, what you see, whether the amount can be changed, and which example shows it.

| | Way | Code needed | Amount fixed? | Best for |
|---|---|---|---|---|
| 1 | [Your QR code](#_1-your-qr-code) | None | No: the payer chooses | A counter, a tip jar, a donation |
| 2 | [A QR code with an amount](#_2-a-qr-code-with-an-amount) | None, or a link you build | No: a suggestion | A price list, a menu |
| 3 | [A request from the app](#_3-a-request-from-the-app) | None | Yes | Billing someone you know |
| 4 | [Checkout on your website](#_4-checkout-on-your-website) | API | Yes | Online orders |
| 5 | [Checkout inside your app](#_5-checkout-inside-your-app) | API | Yes | A mobile or web app |
| 6 | [An open request: a link or QR](#_6-an-open-request-a-link-or-qr) | API | Yes | Invoices, a till, a QR per sale |

Every payment lands in your account the same way: in your
[transactions](/guides/accounts), and as a "payment received" notification on your phone. Webhooks
are coming; until then, your code polls (each example shows how).

::: tip See them all working
[demo.txgold.money](https://demo.txgold.money) runs each way against the Sandbox: the business
on one side, the customer's TxGold app on the other, and each API call between them, with the
sample code behind it.
:::

## 1. Your QR code

**For:** anywhere a customer can see your sign: a counter, a stall, a donation box.

**Try it** in the [live demo](https://demo.txgold.money/your-code).

The TxGold app's **My code** screen shows your account as a QR code. Print it or show it. The
payer scans it, types the amount and pays.

- **What the payer does:** scans, enters an amount, pays.
- **What you see:** the payment, with the payer's memo.
- **Amount:** the payer chooses.
- **It survives a rename.** The QR code carries your account id as well as your handle. If you change
  your handle, old QR codes still pay you, and the app tells the payer the name has changed.

The link inside the QR code is `https://app.txgold.money/RequestPayment?AccountId=<id>&AccountName=<handle>`.

## 2. A QR code with an amount

**For:** a fixed menu or price list, where a QR code per item is handy.

**Try it** in the [live demo](https://demo.txgold.money/code-with-amount).

**My code** can add an amount to the QR code, or you can build the link yourself, with a memo too:

```
https://app.txgold.money/RequestPayment?AccountId=1000007&AccountName=PoolMan&Amt=12.50&Memo=Pool%20check
```

- **What the payer does:** scans; the amount and memo are filled in; pays.
- **What you see:** the payment.
- **Amount:** **a suggestion only.** The payer can change the amount and the memo before paying,
  and anyone can edit the link. When the amount must be exact, use an
  [open request](#_6-an-open-request-a-link-or-qr) instead.
- **Example:** `account-link` builds the link and draws the QR, with no API call.

## 3. A request from the app

**For:** billing someone you know: a client, a member, a tenant.

**Try it** in the [live demo](https://demo.txgold.money/request-from-app).

In the TxGold app, **Request** asks a person to pay a fixed amount. They get a push notification
and a card on their home screen, and pay with a tap. The same request can be made through the API,
with `payerAccountId`, and every request you've made, paid or not, is in
`GET /v1/payment-requests`: see [Payment requests](/guides/payment-requests).

- **Amount:** fixed. The payer pays exactly what you asked, or the payment is refused.
- **What you see:** the request turns `paid`.

## 4. Checkout on your website

**For:** an online shop. The customer types their TxGold handle at checkout and approves on their
phone.

**Try it** in the [live demo](https://demo.txgold.money/website-checkout).

1. Create a request with `payerHandle`: the handle the customer typed.
2. The customer gets a push notification and approves the payment in the TxGold app.
3. Poll the request until it's `paid`, then complete the order. If it isn't paid within your time
   limit, cancel it.

- **Amount:** fixed.
- **Privacy:** the payer's account id is never returned for a request made by handle. A handle
  nobody has is [`payer_account_invalid`](/errors/payer_account_invalid).
- **No handle?** Show an [open request's](#_6-an-open-request-a-link-or-qr) QR at checkout instead,
  and the customer scans it with their phone.
- **Example:** `checkout-handle`.

## 5. Checkout inside your app

**For:** your own mobile or web app.

**Try it** in the [live demo](https://demo.txgold.money/app-checkout).

The same as checkout on a website, with one shortcut. Create an open request and open its
`paymentUrl` on the customer's phone. The TxGold app opens straight on the request, so the
customer doesn't wait for a notification. Then poll until it's `paid`.

- **Amount:** fixed.
- **Coming later:** a way back to your app once the payment is made.
- **Example:** `app-handoff`.

## 6. An open request: a link or QR

**For:** invoices, and tills that show a new QR for each sale.

**Try it** in the [live demo](https://demo.txgold.money/open-request).

An [open request](/guides/payment-requests#open-requests) names no payer. You get a `paymentUrl`:
put it in an invoice email, or draw it as a QR on a screen or a receipt. The first person to pay
it pays it, once.

- **What the payer does:** opens the link or scans the QR. The app shows your stored amount and
  memo. They pay.
- **Amount:** fixed. The link carries the amount for display only. The app shows, and the payment
  must match, the amount you stored, so editing the link changes nothing.
- **Slices:** give each request a `tag` (`till-3`, `spring-campaign`) to tell your tills or
  campaigns apart. Tags are yours and are never shown to the payer.
- **Expiry:** 30 days unless you set `expiresAt`, and at most 90. For a till, set a few minutes, and
  cancel the request if the sale is abandoned.
- **Examples:** `invoice-link` (a request with its QR as an image) and `till-qr` (a new request
  per sale).

## Examples

Each example is in the [samples](https://github.com/tylerchessman/txgold-business/tree/main/samples)
in JavaScript, Python and C#, and runs against the [Sandbox](/sandbox), where demo customers stand
in for real people.

| Example | Shows |
|---|---|
| `account-link` | Ways 1 and 2: build the link and a QR yourself, with no API call |
| `checkout-handle` | Way 4: a request to a handle, poll until paid, cancel on timeout |
| `app-handoff` | Way 5: open the TxGold app on an open request from your app |
| `invoice-link` | Way 6: an open request, its `paymentUrl`, a QR image, poll |
| `till-qr` | Way 6 at a counter: a new open request per sale, shown as a QR, poll, cancel if abandoned |

The `tour` sample remains the quick tour of the whole API. The
[demo site](https://github.com/tylerchessman/txgold-business/tree/main/samples/demo-site) is the
largest sample: a web page and a small server that holds the key.
