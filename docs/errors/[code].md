---
outline: false
---

<script setup>
import { useData } from 'vitepress';
const { params } = useData();
const p = params.value;
const example = [
  `HTTP/1.1 ${p.status}`,
  'Content-Type: application/problem+json',
  '',
  JSON.stringify({ type: `https://docs.txgold.money/errors/${p.code}`, title: p.title, status: p.status, code: p.code, detail: '…', requestId: '7219af94e39d' }, null, 2),
].join(String.fromCharCode(10));
</script>

# {{ $params.title }}

<p><span class="status-pill">HTTP {{ $params.status }}</span> &nbsp; <code>{{ $params.code }}</code></p>

<p v-if="$params.portal"><em>This code belongs to the business portal and the TxGold app. Integrations don't receive it.</em></p>

<!-- @content -->

## The response

<div class="language-json vp-adaptive-theme"><span class="lang">json</span><pre class="shiki"><code>{{ example }}</code></pre></div>

Branch on `code`, never on `title` or `detail`: the code never changes once published, and the
text may. Quote `requestId` to TxGold support. See [all errors](/errors/).
