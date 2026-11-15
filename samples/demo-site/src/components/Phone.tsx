import type { ReactNode } from 'react';
import clsx from 'clsx';
import logo from '@/assets/brand/txgold-logo.png';

/**
 * A simulated TxGold app on a phone. The screens inside are the demo's, drawn to look like the
 * app's; what the buttons do is real (Sandbox pay, cancel).
 */
export function Phone({ who, children, className }: { who?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx('mx-auto w-full max-w-[300px] rounded-[2.25rem] border-[10px] border-ink bg-ink shadow-xl', className)}
      data-testid="phone"
    >
      <div className="flex min-h-[540px] flex-col overflow-hidden rounded-[1.6rem] bg-ground">
        <div className="flex items-center justify-between px-5 pt-2 text-[11px] font-medium text-ink-soft">
          <span>9:41</span>
          <span className="h-4 w-20 rounded-full bg-ink" aria-hidden />
          <span>5G</span>
        </div>
        <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
          <img src={logo} alt="" className="h-6 w-6 rounded-md" />
          <span className="text-sm font-semibold">TxGold</span>
          <span className="ml-auto truncate text-xs text-ink-soft">{who}</span>
        </div>
        <div className="flex flex-1 flex-col p-4">{children}</div>
      </div>
    </div>
  );
}

/** The phone's resting screen. */
export function PhoneIdle({ text }: { text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-ink-soft">
      <div className="h-14 w-14 rounded-full bg-sunken" aria-hidden />
      <p>{text}</p>
    </div>
  );
}
