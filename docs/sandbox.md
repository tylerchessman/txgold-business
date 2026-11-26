# The Sandbox

The Sandbox is a complete, separate TxGold: its own database, accounts, keys and test money. Build
and test there, then switch to Production by changing the key file.

| | Sandbox | Production |
|---|---|---|
| Base URL | `https://api-sandbox.txgold.money` | `https://api.txgold.money` |
| Money | Test TxGold, worth nothing | Real TxGold |
| Customers | Demo customers that pay on request | Real people with the TxGold app |
| Portal sign-in | Your owner key file | The TxGold app on an Admin's phone |
| Extra routes | `/v1/sandbox/…` (below) | None |

The SDKs know both URLs and pick one from the key file's `environment`, so a Production key
talks to Production with no code change.

## What you get

When TxGold sets up your Sandbox business you get its account id, one or two **demo customer**
accounts, and an **owner key file** for signing in to the business portal (the Sandbox has no
phones, so the file stands in for the Admin's TxGold app).

Lost the demo customers' ids? Any of your keys can list them:

```http
GET /v1/sandbox/customers?accountId={accountId}
```

```json
{ "data": [ { "id": "1000004", "accountName": "AcmeSandbox-Customer1",
              "displayName": "Demo Customer 1 (Acme Sandbox)", "balance": "48.50" } ] }
```

Oldest first. The first is the one that pays an open request when you don't name a payer.

## Test money

Add test TxGold to your account, or to one of your demo customers:

```http
POST /v1/sandbox/accounts/{accountId}/fund
{ "amount": "50.00" }
```

The answer is the funding payment, a credit. SDKs: `sandbox.fund` / `Sandbox.FundAsync`.

## Simulating a customer paying

In production a customer pays a request in the TxGold app. In the Sandbox, have the demo customer
pay it:

```http
POST /v1/sandbox/payment-requests/{id}/pay
```

The request must be pending and addressed to one of your demo customers
([`payer_not_demo_customer`](/errors/payer_not_demo_customer) otherwise). The customer is topped
up first if they're short, then pays exactly as in the app, so the request is marked paid and the
payment appears in your history. SDKs: `sandbox.payRequest` / `sandbox.pay_request` /
`Sandbox.PayRequestAsync`.

An [open request](/guides/payment-requests#open-requests) has no payer, so say which demo customer
pays it; leave the body out and your first demo customer does:

```http
POST /v1/sandbox/payment-requests/{id}/pay
{ "payerAccountId": "1000004" }
```

An open request's `paymentUrl` opens the real TxGold app, which can't see Sandbox requests. In the
Sandbox, show the link or QR to check your screens, and pay it with the route above.

## Simulating a customer approving a hold

In production a customer approves a [hold](/guides/holds) in the TxGold app. In the Sandbox, have
the demo customer approve it:

```http
POST /v1/sandbox/holds/{id}/approve
```

The hold must be pending and addressed to one of your demo customers
([`payer_not_demo_customer`](/errors/payer_not_demo_customer) otherwise). The customer is topped
up first if they're short, then approves exactly as in the app, so the hold is `held` and you can
capture or release it. For an open hold, name the demo customer with `{ "payerAccountId": "1000004" }`,
or leave the body out for your first one. SDKs: `sandbox.approveHold` / `sandbox.approve_hold` /
`Sandbox.ApproveHoldAsync`.

## Simulating recurring payments

A [recurring widget](/guides/recurring-payments)'s **Simulate payment** signs a demo customer up
and pays the first period. On the business portal's **Members** page, **Charge now** takes the
next period's payment at once instead of on its due date; tick **Empty the demo customer first**
to see it fail and the plan go past due. The plan's due dates don't move. The Sandbox also takes
due payments on schedule, as Production does.

## What's the same

Everything else: the routes, signing, roles, limits, errors and fees behave as in Production. The
Sandbox's gold rate may lag the real one.
