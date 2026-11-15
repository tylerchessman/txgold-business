import type { Config } from 'tailwindcss';

/**
 * The colour tokens are the business portal's (and the wallet app's), so the demo reads as the
 * same product: navy ink and actions on a light ground, gold as a fill or thin accent only (gold
 * on white fails contrast). Values live in src/index.css as RGB channels.
 */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: 'rgb(var(--ground) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        sunken: 'rgb(var(--sunken) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
          faint: 'rgb(var(--ink-faint) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          ink: 'rgb(var(--brand-ink) / <alpha-value>)',
        },
        gold: {
          DEFAULT: 'rgb(var(--gold) / <alpha-value>)',
          light: 'rgb(var(--gold-light) / <alpha-value>)',
          deep: 'rgb(var(--gold-deep) / <alpha-value>)',
        },
        positive: 'rgb(var(--positive) / <alpha-value>)',
        negative: 'rgb(var(--negative) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        'warning-ground': 'rgb(var(--warning-ground) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
} satisfies Config;
