# Conventions

These hold for every route.

| | |
|---|---|
| **Versions** | The major version is in the path: `/v1`. New fields, routes and enum values can be added at any time and aren't breaking changes, so ignore fields you don't know. |
| **JSON** | `application/json`, UTF-8, camelCase names. Unknown request fields are refused rather than ignored, so a typo can't silently drop a value. |
| **Money** | Decimal strings in TxGold, such as `"12.50"`: at most 2 places in, 2 places out. Never parse them as floats. |
| **Times** | ISO 8601 UTC with `Z`, such as `"2026-10-28T16:04:32.877Z"`. |
| **Ids** | Strings, even when they look numeric. Don't do arithmetic on them. |
| **Errors** | `application/problem+json` with a stable `code`. See [Errors](/errors/). |
| **Request id** | Every response has an `X-Request-Id` header; errors repeat it as `requestId`. |
| **Body size** | At most 64 KB. |

## Lists

Lists answer with a page:

```json
{ "data": [ … ], "nextCursor": "NjM5Mjk1ODMwOTQ0MDIwMjE4LjE0" }
```

Pass `limit` (1 to 200, default 50) and, for the next page, `cursor` set to the previous
`nextCursor`. `nextCursor` is `null` on the last page. A cursor is opaque: don't build or parse
one. The SDKs' `listAll` / `list_all` / `ListAllAsync` and `transactionsAll` walk every page for
you.

## Roles

What a key can do depends on its integration's role:

| | Integration | Device | Device, no refunds |
|---|---|---|---|
| Send payments | ✓ | | |
| Refund | ✓ | ✓ | |
| Payment requests | ✓ | ✓ | |
| See balances | ✓ | | |
| Read accounts, history, rates | ✓ | ✓ | ✓ |

Anything else is [`forbidden`](/errors/forbidden) (403).
