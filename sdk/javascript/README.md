# @txgold/business

The TxGold Business API client for Node.js. See https://github.com/tylerchessman/txgold-business and https://docs.txgold.money.

## 0.2.0

- `paymentRequests.create` takes `payerAccountId`, or `payerHandle`, or neither for an open request (payable once by anyone with its `paymentUrl`), and an optional `tag`.
- `PaymentRequest` adds `isOpen`, `tag` and `paymentUrl`; `payerAccountId` may be null.
- `sandbox.payRequest(requestId, { payerAccountId })` picks which demo customer pays an open request. `sandbox.payRequest(requestId, options)` still works.
