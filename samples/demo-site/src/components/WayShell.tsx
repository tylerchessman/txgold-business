import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { GUIDE_URL, WAYS, type StepName, type Way } from '@/lib/steps';
import type { LogEntry } from '@/lib/useDemoRequest';
import { CodePanel } from './CodePanel';
import { WirePanel } from './WirePanel';

/**
 * One way to get paid: the business on the left, the customer's phone in the middle, and on the
 * right what just happened on the wire and the sample code behind the current step. Above them,
 * a line saying what is going on now.
 */
export function WayShell({
  way,
  now,
  business,
  businessTitle,
  phone,
  entries,
  step,
  onRestart,
  unavailable,
}: {
  way: Way;
  now: ReactNode;
  business: ReactNode;
  businessTitle: string;
  phone: ReactNode;
  entries: LogEntry[];
  step: StepName;
  onRestart?: () => void;
  unavailable?: boolean;
}) {
  const [tab, setTab] = useState<'wire' | 'code'>('wire');
  const next = WAYS.find((w) => w.number === way.number + 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> All six ways
        </Link>
        <h1 className="text-xl font-semibold">
          <span className="text-gold-deep">{way.number}.</span> {way.title}
        </h1>
        <a className="text-sm text-ink-soft underline hover:text-ink" href={`${GUIDE_URL}#${way.anchor}`}>
          In the guide
        </a>
        <div className="ml-auto flex items-center gap-3">
          {onRestart && (
            <button className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink" onClick={onRestart}>
              <RotateCcw className="h-4 w-4" /> Start again
            </button>
          )}
          {next && (
            <Link to={`/${next.slug}`} className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
              {next.number}. {next.title} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gold/40 bg-warning-ground/60 px-4 py-3 text-sm" aria-live="polite" data-testid="now">
        {now}
      </div>

      {unavailable && (
        <div className="rounded-lg border border-negative/30 bg-surface px-4 py-3 text-sm text-negative">
          The Sandbox isn't answering right now, so this step can't run live. Try again in a minute.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px_minmax(0,1.1fr)]">
        <Panel title={businessTitle} subtitle="The business">
          <div className="p-4">{business}</div>
        </Panel>

        <div>
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-ink-faint">The customer's phone</p>
          {phone}
        </div>

        <Panel
          title={
            <div className="flex gap-4">
              {(['wire', 'code'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={clsx('py-1', tab === t ? 'border-b-2 border-gold font-medium text-ink' : 'text-ink-soft hover:text-ink')}
                  aria-pressed={tab === t}
                >
                  {t === 'wire' ? 'What just happened' : 'The code'}
                </button>
              ))}
            </div>
          }
          subtitle="Your server"
        >
          <div className={clsx('h-[540px]', tab === 'wire' ? 'overflow-auto' : 'overflow-hidden')}>{tab === 'wire' ? <WirePanel entries={entries} /> : <CodePanel step={step} />}</div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: ReactNode; subtitle: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <header className="border-b border-line px-4 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{subtitle}</p>
        <div className="text-sm font-semibold">{title}</div>
      </header>
      {children}
    </section>
  );
}
