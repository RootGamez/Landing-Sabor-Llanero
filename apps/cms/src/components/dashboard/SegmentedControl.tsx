import { cn } from '../../lib/utils';

interface SegmentedControlProps<T extends string> {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}

/** Alternar entre vistas de una misma tarjeta (granularidad, cantidad/importe). */
export function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full border-2 border-border bg-card p-0.5">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-10 cursor-pointer rounded-full px-3 text-sm font-semibold transition-colors',
              isActive ? 'bg-primary text-primary-foreground' : 'text-text-muted hover:text-text',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
