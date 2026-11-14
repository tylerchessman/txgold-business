---
layout: home

hero:
  name: TxGold Business API
  text: Take and make gold-backed payments from your own systems
  tagline: Send payments, ask customers to pay, refund, and read your history. Official SDKs for JavaScript, Python and C#.
  image:
    src: /logo.png
    alt: TxGold
  actions:
    - theme: brand
      text: Quickstart
      link: /quickstart
    - theme: alt
      text: API reference
      link: /reference/
      target: _self

features:
  - title: Payments and refunds
    details: Pay any TxGold account, pay a request addressed to you, and refund what you received, in whole or in part.
    link: /guides/payments
  - title: Payment requests
    details: Ask a customer to pay. They get a push notification and pay in the TxGold app; you see it paid.
    link: /guides/payment-requests
  - title: Signed requests, no shared secrets
    details: Each request is signed with your integration's own key. TxGold never sees your private key.
    link: /authentication
  - title: A Sandbox to build in
    details: Test TxGold, demo customers who pay your requests, and the same API as production.
    link: /sandbox
---

::: warning Preview
The API is open in the **Sandbox** and in **Production**. The SDKs are in preview: until 1.0, SDK
minor versions may change their interface.
:::
