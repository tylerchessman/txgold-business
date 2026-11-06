---
title: Errors
---

<script setup>
import errors from './errors.json';
const api = errors.filter((e) => !e.portal);
const portal = errors.filter((e) => e.portal);
</script>

# Errors

Every error is an [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem, with
`Content-Type: application/problem+json`:

```json
{
  "type": "https://docs.txgold.money/errors/insufficient_balance",
  "title": "Insufficient balance",
  "status": 422,
  "code": "insufficient_balance",
  "detail": "Insufficient Balance to process transaction",
  "requestId": "7219af94e39d"
}
```

- **`code`** is what your code branches on. It never changes once published; the `title` and
  `detail` text may. New codes can be added at any time, so handle unknown ones by their `status`.
- **`requestId`** is also in the `X-Request-Id` header of every response. Quote it to TxGold
  support.
- **`errors`** appears on `invalid_request`: each bad field with its problems.
- The SDKs raise one exception type with these fields: `TxGoldApiError` (JavaScript, Python) and
  `TxGoldApiException` (C#).

What the statuses mean:

| Status | Meaning | Retry? |
|---|---|---|
| 400 | The request is wrong | No: fix it first |
| 401 | Who's calling can't be established | No: fix the key, clock or signature |
| 403 | The key may not do this | No |
| 404 | Not found, or not yours | No |
| 409 | Conflicts with the current state | No |
| 413 | Body over 64 KB | No |
| 422 | Well-formed, but a business rule refuses it | Not without changing something |
| 500, 503 | TxGold's side | Yes, with the same timestamp ([how](/guides/idempotency)) |

## All codes

<table>
  <thead><tr><th>Code</th><th>Status</th><th>Title</th></tr></thead>
  <tbody>
    <tr v-for="e in api" :key="e.code">
      <td><a :href="`/errors/${e.code}`"><code>{{ e.code }}</code></a></td>
      <td>{{ e.status }}</td>
      <td>{{ e.title }}</td>
    </tr>
  </tbody>
</table>

## Business portal codes

These go to the business portal and the TxGold app. Integrations don't receive them.

<table>
  <thead><tr><th>Code</th><th>Status</th><th>Title</th></tr></thead>
  <tbody>
    <tr v-for="e in portal" :key="e.code">
      <td><a :href="`/errors/${e.code}`"><code>{{ e.code }}</code></a></td>
      <td>{{ e.status }}</td>
      <td>{{ e.title }}</td>
    </tr>
  </tbody>
</table>
