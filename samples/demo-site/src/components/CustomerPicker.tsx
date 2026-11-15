import type { DemoConfig } from '@/lib/api';

/** "You are @TxGDemo-Customer1": which demo customer the phone belongs to. */
export function CustomerPicker({
  config,
  value,
  onChange,
  disabled,
}: {
  config: DemoConfig | null;
  value: number;
  onChange: (index: number) => void;
  disabled?: boolean;
}) {
  if (!config) return null;
  return (
    <label className="flex items-center gap-1">
      <span className="sr-only">You are</span>
      <select
        className="max-w-[9.5rem] truncate rounded border border-line bg-surface px-1 py-0.5 text-xs"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        data-testid="customer-picker"
      >
        {config.customers.map((c) => (
          <option key={c.index} value={c.index}>
            @{c.handle}
          </option>
        ))}
      </select>
    </label>
  );
}
