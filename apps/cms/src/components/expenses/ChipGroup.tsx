import { cn } from '../../lib/utils';

export interface ChipOption<V extends string | number> {
  value: V;
  label: string;
  /** Color de la categoría; solo decorativo (el nombre siempre está en el texto). */
  color?: string | null;
}

interface ChipGroupProps<V extends string | number> {
  label: string;
  options: readonly ChipOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
}

/** Botones tipo "chip" de selección única (≥44 px de alto para tocar con el pulgar). */
export function ChipGroup<V extends string | number>({ label, options, value, onChange }: ChipGroupProps<V>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold transition-colors',
              selected
                ? 'border-forest bg-primary text-primary-foreground'
                : 'border-border bg-surface text-text hover:border-forest-line/60',
            )}
          >
            {option.color && (
              <span aria-hidden="true" className="size-3 rounded-full border border-forest/30" style={{ backgroundColor: option.color }} />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
