import { cn } from '../../lib/utils';

export type CountMode = 'count' | 'amount';

const OPTIONS: ReadonlyArray<{ value: CountMode; label: string }> = [
  { value: 'count', label: 'Contar billetes y monedas' },
  { value: 'amount', label: 'Escribir el monto' },
];

interface CountModeToggleProps {
  mode: CountMode;
  onChange: (mode: CountMode) => void;
}

/** Elige cómo ingresar el efectivo contado. Radios nativos: flechas y lector de pantalla gratis. */
export function CountModeToggle({ mode, onChange }: CountModeToggleProps) {
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">Cómo registrar el efectivo contado</legend>
      {OPTIONS.map((option) => (
        <label
          key={option.value}
          className={cn(
            'inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 px-4 text-sm font-bold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
            mode === option.value ? 'border-forest bg-forest text-primary-foreground' : 'border-border bg-surface text-text hover:border-forest',
          )}
        >
          <input
            type="radio"
            name="closure-count-mode"
            value={option.value}
            checked={mode === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
