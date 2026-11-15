import { useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import { ExternalLink } from 'lucide-react';
import { SAMPLES, SAMPLE_URL, statementRange } from '@/lib/samples';
import { STEP_MARKERS, type StepName } from '@/lib/steps';

/** The sample file behind the current step, with that step's statement highlighted. */
export function CodePanel({ step }: { step: StepName }) {
  const { file, marker } = STEP_MARKERS[step];
  const source = SAMPLES[file];
  const lines = useMemo(() => source.replace(/\n$/, '').split('\n'), [source]);
  const range = useMemo(() => statementRange(source, marker), [source, marker]);
  const first = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLPreElement>(null);

  // Scroll the code (not the page) to the step
  useEffect(() => {
    if (first.current && box.current)
      box.current.scrollTo({ top: Math.max(0, first.current.offsetTop - box.current.clientHeight / 3), behavior: 'smooth' });
  }, [step]);

  return (
    <div className="flex h-full flex-col" data-testid="code-panel">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-xs">
        <span className="font-mono font-medium">samples/javascript/{file}</span>
        <a className="ml-auto inline-flex items-center gap-1 text-ink-soft hover:text-ink" href={SAMPLE_URL(file)} target="_blank" rel="noreferrer">
          On GitHub <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <pre ref={box} className="relative flex-1 overflow-auto py-2 font-mono text-[11px] leading-[1.6]">
        {lines.map((line, i) => {
          const lit = range !== null && i >= range[0] && i <= range[1];
          return (
            <div
              key={i}
              ref={range !== null && i === range[0] ? first : undefined}
              className={clsx('flex pr-4', lit ? 'bg-gold/15' : line.trimStart().startsWith('//') && 'text-ink-faint')}
            >
              <span className={clsx('w-10 shrink-0 select-none pr-3 text-right', lit ? 'text-gold-deep' : 'text-ink-faint')}>{i + 1}</span>
              <span className={clsx('whitespace-pre', lit && 'border-l-2 border-gold pl-2 -ml-[10px]')}>{line || ' '}</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
