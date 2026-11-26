# Memberships and monthly giving

Get paid **every month, quarter or year** without asking each time: club dues, a gym membership,
a monthly gift. A member approves your plan once in the TxGold app and pays the first period
there and then. TxGold charges each later period on its due date, sends the member a receipt, and
keeps going until the member or you cancel it, or the plan's last payment is made.

It needs no code. You set it up on a [pay widget](/guides/pay-widget) and see your members on the
[business portal](https://business.txgold.money)'s **Members** page.

::: tip Who can set one up
An **Admin** of a business or charity account, signed in to the business portal. Recurring
payments through the API, with webhooks, are planned; for now they are set up on a widget.
:::

## What a member sees

1. **On your site:** a widget showing the plan under the amount, for example "5.00 TxGold a month
   (about 22.00 USD) · Cancel any time in TxGold". They fill in your fields and tap **Join**
   (or **Give**), then scan the QR code or tap **Open TxGold**.
2. **In the TxGold app,** a screen that says in plain words what they're agreeing to:

   > **Friends of the Park** will charge **5.00 TxGold a month** (about 22.00 USD today), until
   > you cancel. The first payment is now.

   It shows the next payment date and when the plan ends. The member confirms with their
   fingerprint, face or device code, every time, whatever the amount. Approving pays the first
   period and signs the terms with the member's key: TxGold keeps that signature as the record of
   what they agreed to.
3. **Each later period,** TxGold takes the payment on its due date without asking again, and the
   member gets a receipt: "Friends of the Park charged 5.00 TxGold". It's an ordinary payment in
   their history.
4. **If a payment fails,** usually for want of TxGold, the member gets a notice and a card on
   their Home screen with **Pay now**. TxGold also retries by itself (see [Due dates and
   failures](#due-dates-and-failures)).
5. **Cancelling** is two taps, any time, in **Profile › Recurring payments**. Future payments stop
   at once. Payments already made aren't refunded automatically.

Yearly plans also get a reminder 14 days before each renewal.

## Set it up

In the portal, open **Widgets** and choose **New widget**. Two presets get you started, both in
TxGold, and you can change every setting after:

| Preset | Amount | Charge | Button |
|---|---|---|---|
| **Membership** | Fixed: one price | Recurring, monthly | Join |
| **Monthly giving** | Choose: a few amounts, and Other | Both: the visitor picks Once or Monthly | Give |

Or start from a blank widget and set **One-time or recurring**:

| Setting | Values |
|---|---|
| **Charge** | **One-time** (each payment stands alone), **Recurring** (every visitor signs up), or **Both** (the visitor chooses "Once" or the period: good for giving pages) |
| **Every** | Month, quarter or year |
| **Ends** | When cancelled, or after a number of payments (2 to 120, the first included) |

Everything else works as for any widget: the amount (Choose, Fixed or Free), the fields you ask
for, your memo, colours, and the sites it may appear on. **The amount picked at sign-up is the
amount every period.** The preview beside the form shows the plan line and what the member will
see in the app.

### TxGold or US dollars

Plans are in **TxGold** unless you choose dollars.

- **A TxGold plan** charges exactly that many TxGold each period.
- **A USD plan** charges the dollar amount converted at the gold price when each payment is taken,
  so the TxGold amount moves with the price. The member approves a **ceiling** of the first
  payment's TxGold plus 25%. If the gold price falls so far that the dollar amount would be more
  TxGold than that, the payment fails rather than charge more than they agreed to.

### Changing a plan

A change to the widget applies to **new** members. Existing members keep the terms they approved:
you can't raise what someone pays without their say-so. To move existing members to a new price,
end their plans with a message asking them to join again (see [Ending one](#ending-one)), and they
sign up at the new price.

## Due dates and failures

- **The due date** is the same day of the month as the first payment (in UTC), every month,
  quarter or year. In a shorter month it falls on the last day: a plan started on the 31st is
  charged on the 30th in April and the 28th or 29th in February, then the 31st again.
- **Payments are taken once a day,** at about 15:00 UTC.
- **A failed payment** is retried 1, 3 and 7 days after its due date. From the first failure the
  member is **past due**, and can pay from the app at any time.
- **One payment per period, ever.** A missed period is never charged together with the next one.
- **Lapsed:** if a period is still unpaid 30 days after its due date, the plan ends. You and the
  member are told. To rejoin, the member signs up again.
- **Daily limits:** a recurring payment counts against the member's daily sending limit like any
  payment. A member whose limit is below your plan's amount is told so before they join, so the
  first renewal doesn't fail.

## Your members

The portal's **Members** page lists everyone paying you by recurring payment:

- **Status:** Active, Past due, Cancelled by the member, Ended by you, Completed (all its payments
  made) or Lapsed. Filter by status or by widget.
- **The plan,** the payments made, the next due date and the last payment.
- **Open a member** to see their details from your widget's fields and every payment and failed
  charge, with the reason it failed.
- **Download CSV:** one row per member, with your widget's fields in their own columns.

On the **Transactions** page, each payment from a plan is marked **Recurring**, with which payment
of the plan it was, and links to that member. Its CSV has the same two columns.

### Ending one

Open a member and choose **End this recurring payment**. No further payments are taken, not even
one due today, and the member is told, with your message if you add one ("Our dues are changing;
please join again at the new rate."). It can't be undone: the member signs up again to rejoin.
Payments already made aren't refunded automatically; refund one as you refund any payment.

### The daily email

When something needs your attention, TxGold emails your Admins once a day: new members, failed
payments, members now past due, cancellations and lapses. It goes to each Admin with a verified
email address, names members only by their TxGold display name, and links to the Members page.
Switch it off or on at the top of the Members page.

## Try it in the Sandbox

In the Sandbox, create a recurring widget and press **Simulate payment** on its page: a demo
customer signs up and pays the first period. On the **Members** page, open the new member and use
**Charge now** to take the next period's payment at once, rather than waiting a month. Tick
**Empty the demo customer first** to see a payment fail and the plan go past due. The plan's real
due dates don't move. See [The Sandbox](/sandbox).

## Your obligations

TxGold gives members a clear approval screen, a receipt for every payment, a reminder before
yearly renewals and cancellation in two taps. **The plan itself is yours,** and so are the duties
that come with selling or soliciting something that renews automatically. In the United States
these include the federal Restore Online Shoppers' Confidence Act and state automatic-renewal
laws, such as California's. They generally ask the seller to:

- **state the terms clearly before sign-up:** what is charged, how often, until when, and how to
  cancel. Put them on your page next to the widget, not only in the app;
- **get the member's consent** to those terms (the app's approval records it);
- **make cancelling easy:** tell members they can cancel in the TxGold app, and honour a request
  that reaches you another way by ending the plan on the Members page;
- **give notice** before a free or discounted period becomes paid, or before a price change, where
  the law asks for it.

Rules differ by state and by country, and for charities and donations. This is not legal advice:
check what applies to you. Payments to you are final, with no chargebacks, so be ready to refund
a member who was charged in error or who cancelled and asks for one.

## Limits

- **The member needs the TxGold app,** with a balance to pay from. TxGold doesn't top it up.
- **Month, quarter or year.** No weekly plans.
- **One amount per plan.** No trial periods, discounts, or set-up fees.
- **An existing member's price can't be changed** (see [Changing a plan](#changing-a-plan)).
- **Not yet in the API:** recurring payments and their webhooks for developers are planned. Their
  payments already appear in [`GET /v1/accounts/{accountId}/transactions`](/guides/accounts#list-transactions)
  with `mandateId` (the plan, `md_...`) and `mandatePeriod` (which of its payments it is).

## Errors in the portal

| Code | What it means |
|---|---|
| [`mandate_ended`](/errors/mandate_ended) | The recurring payment has already ended: cancelled, completed or lapsed. Reload the Members page. |
| [`invalid_request`](/errors/invalid_request) | A setting broke one of the rules above, such as a number of payments outside 2 to 120. The form shows which one, beside the field. |
