# The Sandbox

The Sandbox is a complete, separate TxGold: its own database, accounts, keys and test money. Build
and test there, then switch to Production by changing the key file.

| | Sandbox | Production |
|---|---|---|
| Base URL | `https://func-txgbusiness-dev-ffdea6gbbjhzczex.southcentralus-01.azurewebsites.net` | Announced when it opens |
| Money | Test TxGold, worth nothing | Real TxGold |
| Customers | Demo customers that pay on request | Real people with the TxGold app |
| Portal sign-in | Your owner key file | The TxGold app on an Admin's phone |
| Extra routes | `/v1/sandbox/…` (below) | None |

The SDKs know the Sandbox URL and pick it from the key file's `environment`.

## What you get

When TxGold sets up your Sandbox business you get its account id, one or two **demo customer**
accounts, and an **owner key file** for signing in to the business portal (the Sandbox has no
phones, so the file stands in for the Admin's TxGold app).

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

## What's the same

Everything else: the routes, signing, roles, limits, errors and fees behave as in Production. The
Sandbox's gold rate may lag the real one.
