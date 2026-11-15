import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import type { LogEntry } from '@/lib/useDemoRequest';

/** "What just happened": each Business API call of this run, newest last, the newest opened. */
export function WirePanel({ entries }: { entries: LogEntry[] }) {
  const list = useRef<HTMLOListElement>(null);
  // Keep the newest call in view, scrolling the panel (its parent), not the page
  useEffect(() => {
    const scroller = list.current?.parentElement;
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
  }, [entries]);

  if (entries.length === 0)
    return (
      <p className="p-4 text-sm text-ink-soft">
        Each call to the TxGold Business API shows up here as it happens: the request your server
        signs and sends, and what comes back.
      </p>
    );

  const lastExchange = [...entries].reverse().find((e) => e.kind === 'exchange')?.id;
  return (
    <ol ref={list} className="divide-y divide-line" data-testid="wire-panel">
      {entries.map((entry) =>
        entry.kind === 'note' ? (
          <li
            key={entry.id}
            className={clsx(
              'px-4 py-2 text-xs',
              entry.tone === 'simulated' && 'bg-warning-ground text-warning',
              entry.tone === 'error' && 'text-negative',
              entry.tone === 'info' && 'text-ink-soft',
            )}
          >
            {entry.text}
          </li>
        ) : (
          <ExchangeItem key={`${entry.id}-${entry.repeats}`} entry={entry} open={entry.id === lastExchange} />
        ),
      )}
    </ol>
  );
}

function ExchangeItem({ entry, open: initiallyOpen }: { entry: Extract<LogEntry, { kind: 'exchange' }>; open: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const { exchange } = entry;
  const ok = exchange.status < 400;
  return (
    <li className="text-xs">
      <button className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-sunken" onClick={() => setOpen(!open)} aria-expanded={open}>
        <ChevronRight className={clsx('h-3.5 w-3.5 shrink-0 text-ink-faint transition', open && 'rotate-90')} />
        <span className="min-w-0 flex-1">
          <span className="block text-ink-soft">{entry.step}{entry.repeats > 1 && ` ×${entry.repeats}`}</span>
          <span className="block truncate font-mono">
            <span className="font-semibold">{exchange.method}</span> {exchange.path}
          </span>
        </span>
        <span className={clsx('rounded px-1.5 py-0.5 font-mono font-semibold', ok ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative')}>
          {exchange.status}
        </span>
        <span className="w-12 text-right tabular-nums text-ink-faint">{exchange.ms} ms</span>
      </button>
      {open && (
        <div className="space-y-2 bg-sunken/60 px-4 pb-3 pt-1">
          <Block title="Request">
            {`${exchange.method} ${exchange.origin}${exchange.path}\n`}
            {Object.entries(exchange.requestHeaders).map(([name, value]) => `${name}: ${value}\n`).join('')}
            {exchange.requestBody !== null && `\n${JSON.stringify(exchange.requestBody, null, 2)}`}
          </Block>
          <Block title={`Response ${exchange.status}`}>{exchange.responseBody === null ? '(no body)' : JSON.stringify(exchange.responseBody, null, 2)}</Block>
        </div>
      )}
    </li>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-medium text-ink-soft">{title}</p>
      <pre className="max-h-72 overflow-auto rounded-md border border-line bg-surface p-2 font-mono text-[11px] leading-relaxed">{children}</pre>
    </div>
  );
}
