# Pay widget

Take TxGold on your own website with no code and no keys. Set up a **pay widget** in the
[business portal](https://business.txgold.money), then paste a link or a few lines of HTML into
your site, the way you'd add a video. A visitor chooses an amount, fills in the details you ask
for, and pays in the TxGold app. You see each payment, with those details, in your transactions.

It suits donations, tickets, dues, deposits, invoices and single items. A widget can also sign
members up to pay **every month, quarter or year**: see
[Memberships and monthly giving](/guides/recurring-payments). A shopping cart is a job for the
API: see [Ways to get paid](/guides/ways-to-get-paid).

::: tip Who can set one up
An **Admin** of a business or charity account, signed in to the business portal. A business can
have up to 50 widgets.
:::

## What a visitor sees

1. **The amount:** buttons with your amounts, a box for any amount between your minimum and
   maximum, or a fixed price ("Gala ticket: 25.00"). Amounts show in TxGold with the dollar value
   beside them.
2. **The details** you ask for: name, email, phone and one field of your own ("In memory of",
   "Order number"). A line tells them their details go to you with the payment.
3. **Give**, **Pay**, **Buy** or **Join.** On a computer the widget shows a QR code to scan with the TxGold
   app. On a phone it shows an **Open TxGold** button, with the QR code below for paying from a
   second phone.
4. **The payment, in the TxGold app.** The app shows your name, the amount and your memo. The
   visitor approves it as they approve any payment, and can't change the amount. No money moves
   inside the widget itself.
5. **Thank you.** The widget shows your thank-you text. A request that isn't paid within
   15 minutes expires, and the visitor can start again.

A small "Get the app" link is there for visitors who don't have TxGold yet.

## Set up a widget

In the portal, open **Widgets** and choose **New widget**. The preview beside the form shows what
visitors will see.

### Name

Your own name for the widget, such as "General giving" or "Gala tickets". Visitors don't see it;
it tells your widgets apart in the portal and in your transactions.

### Amount

| Kind | You set | Example |
|---|---|---|
| **Choose** | Up to 6 amounts, and if you like an "Other" box with a minimum and maximum | Donations: 10 / 25 / 50 / Other |
| **Fixed** | One price, the item's name, and how many a visitor may buy at once (1 to 10) | "Gala ticket" at 25.00 |
| **Free** | A minimum and a maximum | "Pay your invoice" |

- **Amounts are in TxGold**, or in US dollars if you prefer. Dollar amounts are converted to TxGold
  at the current rate when the visitor presses Pay, and the visitor pays the TxGold amount shown.
- **Every amount must be more than 0.02 TxGold.**
- **The cap** is the most any one payment may be (1,000 TxGold unless you change it), so a typing
  mistake can't ask a visitor for a fortune.

### What to ask the visitor

Name, email, phone, and a **reference** field with your own label. Each is **Don't ask**,
**Optional** or **Required**, and each has a length limit.

All the details travel together in 255 characters, so the form shows how much room is left as you
choose fields. With name, email and phone on, about 95 characters remain for the reference: room
for "In memory of Margaret Thompson" or an order number and a short note. Postal addresses don't
fit.

The details are what the visitor typed. TxGold checks that an email looks like one and a phone
number is digits, but doesn't verify either.

### Words and looks

- **Memo:** what the payer's app shows, and the memo on the payment, such as "Donation to Friends
  of the Park". Up to 100 characters. Visitors can't change it.
- **Button:** Give, Pay, Buy or Join.
- **Color:** the button color. It must be dark enough for white text to be read on it; the form
  tells you if it isn't.
- **Light or dark:** or follow the visitor's own setting.
- **Thank-you text:** shown once the payment is made.

### One-time or recurring

**One-time** unless you choose **Recurring** (every visitor signs up to pay each month, quarter or
year) or **Both** (the visitor picks "Once" or the period). See
[Memberships and monthly giving](/guides/recurring-payments).

### Where it may appear

- **Your websites,** one per line, such as `https://friendsofthepark.example.org`: the only sites that may
  show the widget **inside** their pages. If your site works both with and without `www.`, list
  both. With none listed, the widget works as a link or button only.
- **Return URL** (optional): a page on one of those sites, such as your thank-you page. After paying,
  the visitor gets a **Back to** link to it. See [The return URL](#the-return-url).

Choose **Create widget**. The portal signs the widget's settings with your session and sends them
to TxGold, which keeps them exactly as signed, with who signed them and when. Only payments that fit
those settings can be made through the widget.

## Put it on your site

Choose **Get the code** on the widget. You get its address, two snippets and a QR code.

### A link or button: works everywhere

```html
<a href="https://pay.txgold.money/w/pw_7Hq2kV9xR4mN3pQs">Pay with TxGold</a>
```

The widget opens as a page of its own on pay.txgold.money. This is the dependable choice: it
works on every site builder, and in an email, a newsletter or a social post. Most site builders
have a **Button** element: give it the widget's address as its link.

### Inline, inside your page

```html
<iframe src="https://pay.txgold.money/w/pw_7Hq2kV9xR4mN3pQs" title="Pay with TxGold"
        width="100%" height="560" style="border:0" allow="clipboard-write"></iframe>
```

The widget shows inside your page, on the sites you listed under **Where it may appear**. On any
other site it refuses to show.

### A QR code to print

For a poster, a flyer or a counter: the QR code opens the widget's page on the visitor's phone.

### Site builders

| Builder | Inline widget | Link or button |
|---|---|---|
| **WordPress** | In the block editor, add a **Custom HTML** block and paste the `<iframe>`. On WordPress.com this needs a plan that allows custom code. | Add a **Buttons** block and set its link. |
| **Squarespace** | Add a **Code** block and paste the `<iframe>`, on plans that allow code blocks. | Add a **Button** block and set its link. |
| **Wix** | Wix shows embedded code inside a frame of its own, on its own address, so the inline widget usually won't appear. Use a button. | Add a **Button** and link it to **Web address**. |
| **GoDaddy** | GoDaddy's **HTML** section also uses a frame of its own; use a button. | Add a button to a section and link it to the widget's address. |
| **Your own site** | Paste the `<iframe>` where it should appear. | Paste the `<a>` link and style it as you like. |

Builders change their menus from time to time. If a step doesn't match what you see, look for
the builder's "embed HTML" or "button link" help.

### Fill in the details for a signed-in visitor

If your site already knows who the visitor is, it can fill in the form for them. Put the values
after `#` in the widget's address:

```
https://pay.txgold.money/w/pw_7Hq2kV9xR4mN3pQs#name=Jane%20Doe&email=jane%40example.com
```

The part after `#` stays in the visitor's browser and never reaches a server. The keys are `name`,
`email`, `phone` and `reference`, and the visitor can still change what's filled in. A site with
the inline widget can also send them as a message: see [Events](#events-for-developers).

## See the payments

Each payment arrives like any other: a "payment received" notification, your balance and your
history. On the portal's **Transactions** page:

- a payment from a widget shows the widget's name and the visitor's details;
- **Download CSV** gives the chosen dates as a spreadsheet, with a column for each detail (Name,
  Email, Phone and your reference's label);
- **Erase** removes the details from one payment for good, for example when a visitor asks you to
  delete them. The payment itself stays.

Through the API, the same payments are in
[`GET /v1/accounts/{accountId}/transactions`](/guides/accounts#list-transactions):
`paymentRequestTag` is the widget's id, and `memoInternal` holds the details as typed, in the
widget's field order with ` | ` between them:

```
Jane Doe | jane@example.com | 555-0100 | Margaret Thompson
```

Details are personal data, so only the Integration role sees them; the device roles get `null`.

## Change, pause or delete

- **Edit:** a change applies to new visitors. A payment already started keeps the settings it was
  started with.
- **Pause:** stops new payments at once; the widget tells visitors it isn't taking payments.
  **Resume** turns it back on. Payments already started can still be paid until they expire.
- **Delete:** stops the widget for good and removes it from the list. Payments it brought in stay
  in your history.

## Try it in the Sandbox

Sign in to the portal, choose the **Sandbox**, and create a widget there. Sandbox widgets live on
`pay-sandbox.txgold.money` and take no real payments: instead of the TxGold app, the widget has a
**Simulate payment** button that has a demo customer pay. Put the Sandbox snippet on a test page of
your site, try the whole flow, then create the widget in Production and switch the snippet. See
[The Sandbox](/sandbox).

## Events (for developers)

The inline widget tells the page around it what's happening, with `postMessage`. It sends messages
only to a site on its list, and each message is an object with a `type`:

| `type` | Other fields | When |
|---|---|---|
| `txgold:ready` | `widgetId` | The widget has loaded. |
| `txgold:resize` | `height` (pixels) | The widget's height changed. Set the `<iframe>`'s height to it if you like. |
| `txgold:paid` | `requestId`, `amount` (TxGold, a decimal string), and for a sign-up to a [recurring payment](/guides/recurring-payments) `mandateId` | The visitor's payment went through. |
| `txgold:expired` | `requestId` | The visitor's 15 minutes ran out. |

Your page can send `txgold:prefill` with a `fields` object to fill in the form, from a site on the
widget's list only:

```js
const frame = document.querySelector('iframe[src^="https://pay.txgold.money/"]');

window.addEventListener('message', (event) => {
  if (event.origin !== 'https://pay.txgold.money' || event.source !== frame.contentWindow) return;
  const message = event.data;
  if (message.type === 'txgold:ready') {
    frame.contentWindow.postMessage(
      { type: 'txgold:prefill', fields: { name: 'Jane Doe', email: 'jane@example.com' } },
      'https://pay.txgold.money',
    );
  }
  if (message.type === 'txgold:resize') frame.style.height = `${message.height}px`;
  if (message.type === 'txgold:paid') showThanks(message.requestId);
});
```

For a Sandbox widget, the origin is `https://pay-sandbox.txgold.money`.

### The return URL

With a return URL set, the widget's **Back to** link, shown once the payment is made, adds the
request's id and `status=paid`:

```
https://friendsofthepark.example.org/thanks?txgoldRequest=4471&status=paid
```

It carries no personal data.

::: warning Events and return URLs are not proof of payment
Anyone can post a message to your page or type a URL into their browser. Use them to say thank
you, not to hand over goods. Before you ship, check that the payment is in your history, or
in the app's "payment received" notification. To check automatically, look the request up with an
Integration key: [`GET /v1/payment-requests/{id}`](/guides/payment-requests#watch-for-payment)
says `paid` only when it has been paid, and its `paymentId` is the payment.
:::

## Limits

- **The payer needs the TxGold app.** Keep your other ways to pay alongside the widget.
- **No postal addresses, carts, shipping or tax.**
- **Details are what the visitor typed**, not verified.
- **Rate limits:** a widget accepts up to 60 new payments a minute, and 10 an hour from one
  visitor's address.
- **Your visitors' details:** TxGold keeps them with the payment, for you. See the
  [privacy policy](https://txgold.money/privacy).

## Errors in the portal

| Code | What it means |
|---|---|
| [`widget_limit`](/errors/widget_limit) | The business already has 50 widgets. Delete one first. |
| [`invalid_request`](/errors/invalid_request) | A setting broke one of the rules above. The form shows which one, beside the field. |
| [`forbidden`](/errors/forbidden) | Only an Admin of an active business or charity account can manage widgets. |
