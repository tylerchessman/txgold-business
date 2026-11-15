import type { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'danger' | 'quiet';

const STYLES: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:opacity-90',
  secondary: 'border border-line bg-surface text-ink hover:bg-sunken',
  danger: 'border border-negative/40 bg-surface text-negative hover:bg-negative/5',
  quiet: 'text-ink-soft hover:text-ink',
};

export function Button({ variant = 'primary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        STYLES[variant],
        className,
      )}
      {...props}
    />
  );
}
