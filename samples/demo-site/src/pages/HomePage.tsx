import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { GUIDE_URL, WAYS } from '@/lib/steps';

export function HomePage() {
  return (
    <div className="space-y-8">
      <section className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-semibold">Six ways to get paid with TxGold</h1>
        <p className="text-ink-soft">
          Try each one from both sides: the business, and the customer's phone. Every payment
          request here is a real call to the TxGold Business API in the Sandbox, with test TxGold.
          Beside each step you see the exact request and response, and the sample code that made
          it.
        </p>
        <p className="text-sm text-ink-soft">
          The first three need no code at all. The other three use the API.{' '}
          <a className="underline hover:text-ink" href={GUIDE_URL}>
            Read the guide
          </a>
          .
        </p>
      </section>

      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {WAYS.map((way) => (
          <li key={way.slug}>
            <Link
              to={`/${way.slug}`}
              className="group flex h-full flex-col rounded-xl border border-line bg-surface p-5 transition hover:border-ink-soft hover:shadow-sm"
            >
              <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/20 text-gold-deep">{way.number}</span>
                {way.code === 'API' ? 'With the API' : 'No code'}
              </span>
              <span className="mt-3 text-lg font-semibold">{way.title}</span>
              <span className="mt-1 flex-1 text-sm text-ink-soft">{way.summary}</span>
              <span className="mt-4 flex items-center justify-between text-xs text-ink-soft">
                <span>Best for: {way.bestFor}</span>
                <ArrowRight className="h-4 w-4 text-ink transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <section className="max-w-3xl rounded-xl border border-line bg-surface p-5 text-sm text-ink-soft">
        <h2 className="mb-2 text-base font-semibold text-ink">What's real and what's simulated</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>The business side is real: payment requests, polling, cancelling and transactions all go to the Sandbox API.</li>
          <li>The customer's phone is simulated. When you tap Approve, the Sandbox pays the request for a demo customer, exactly as the TxGold app would.</li>
          <li>In ways 1 and 2 the customer pays the account directly, with no request; that payment is shown, not made.</li>
          <li>
            Ready to build? Get a Sandbox key in the{' '}
            <a className="underline hover:text-ink" href="https://business.txgold.money">business portal</a> and start with the{' '}
            <a className="underline hover:text-ink" href="https://docs.txgold.money/quickstart">quickstart</a>.
          </li>
        </ul>
      </section>
    </div>
  );
}
