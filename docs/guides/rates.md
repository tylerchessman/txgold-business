# Rates

```http
GET /v1/rates
```

```json
{ "usdPerTxGold": "4.400000", "usdPerTroyOunce": "4400.00", "asOf": "2026-11-04T18:12:35.937Z" }
```

One TxGold is a thousandth of a troy ounce of gold, so `usdPerTxGold` is the gold price divided by
1,000, given to 6 places. `asOf` is when that price was taken.

Use it to show customers a dollar figure, or to turn a dollar price into TxGold:

```js
const rate = await client.rates.get();
const txgold = (dollars / Number(rate.usdPerTxGold)).toFixed(2); // round as your pricing rules say
```

The rate is informational: payments are always in TxGold. When TxGold has no price to give, the
answer is [`rate_unavailable`](/errors/rate_unavailable) (503); retry in a few minutes.
