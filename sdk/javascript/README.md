# @txgold/business

The TxGold Business API client for Node.js. See https://github.com/tylerchessman/txgold-business and https://docs.txgold.money.

## 0.3.0

- `holds`: `create`, `get`, `list`, `listAll`, `capture` and `release`, for holding an amount on a customer's balance and charging what was used (pay at the pump). New types `Hold`, `HoldCreate`, `HoldCapture`, `HoldCaptureResult` and `HoldStatus`.
- `sandbox.approveHold(holdId, { payerAccountId })` approves a pending hold as a demo customer.

## 0.2.0

- `paymentRequests.create` takes `payerAccountId`, or `payerHandle`, or neither for an open request (payable once by anyone with its `paymentUrl`), and an optional `tag`.
- `PaymentRequest` adds `isOpen`, `tag` and `paymentUrl`; `payerAccountId` may be null.
- `sandbox.payRequest(requestId, { payerAccountId })` picks which demo customer pays an open request. `sandbox.payRequest(requestId, options)` still works.
