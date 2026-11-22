import { defineConfig } from 'vitepress';
import errors from '../errors/errors.json' with { type: 'json' };

const byStatus = (from: number, to: number) =>
  errors.filter((e) => e.status >= from && e.status < to && !e.portal).map((e) => ({ text: e.code, link: `/errors/${e.code}` }));

export default defineConfig({
  title: 'TxGold Business API',
  description: 'Send and request TxGold payments from your own systems.',
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,
  // Error pages come from one template; give each its own title (the tab text and search)
  transformPageData(pageData) {
    if (pageData.params?.code && pageData.params?.title) pageData.title = `${pageData.params.title} (${pageData.params.code})`;
  },
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
    ['meta', { name: 'theme-color', content: '#1e1e35' }],
  ],
  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'TxGold Business',
    nav: [
      { text: 'Quickstart', link: '/quickstart' },
      { text: 'Guides', link: '/guides/payments' },
      { text: 'API reference', link: '/reference/', target: '_self' },
      { text: 'Errors', link: '/errors/' },
      { text: 'Changelog', link: '/changelog' },
      { text: 'Live demo', link: 'https://demo.txgold.money' },
      { text: 'Business portal', link: 'https://business.txgold.money' },
    ],
    sidebar: [
      {
        text: 'Start here',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Quickstart', link: '/quickstart' },
          { text: 'Authentication', link: '/authentication' },
          { text: 'The Sandbox', link: '/sandbox' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Ways to get paid', link: '/guides/ways-to-get-paid' },
          { text: 'Payments and refunds', link: '/guides/payments' },
          { text: 'Payment requests', link: '/guides/payment-requests' },
          { text: 'Accounts and history', link: '/guides/accounts' },
          { text: 'Rates', link: '/guides/rates' },
          { text: 'Idempotency and retries', link: '/guides/idempotency' },
          { text: 'Conventions', link: '/guides/conventions' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'API reference', link: '/reference/', target: '_self' },
          { text: 'Errors', link: '/errors/' },
          { text: 'Changelog', link: '/changelog' },
        ],
      },
      { text: '400 and 401 errors', collapsed: true, items: byStatus(400, 402) },
      { text: '403 to 413 errors', collapsed: true, items: byStatus(403, 414) },
      { text: '422 errors', collapsed: true, items: byStatus(422, 423) },
      { text: '5xx errors', collapsed: true, items: byStatus(500, 600) },
    ],
    search: { provider: 'local' },
    outline: { level: [2, 3] },
    footer: {
      message: 'The SDKs are MIT licensed.',
      copyright: '© 2026 TxGold',
    },
  },
});
