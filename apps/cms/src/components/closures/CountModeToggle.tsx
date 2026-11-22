import { SegmentedControl } from '../ui/SegmentedControl';

export type CountMode = 'count' | 'amount';

const OPTIONS: ReadonlyArray<{ value: CountMode; label: string }> = [
  { value: 'count', label: 'Contar billetes y monedas' },
  { value: 'amount', label: 'Escribir el monto' },
];

interface CountModeToggleProps {
  mode: CountMode;
  onChange: (mode: CountMode) => void;
}

/** Elige cómo ingresar el efectivo contado (selector segmentado: flechas y lector de pantalla). */
export function CountModeToggle({ mode, onChange }: CountModeToggleProps) {
  return (
    <SegmentedControl
      aria-label="Cómo registrar el efectivo contado"
      value={mode}
      onValueChange={(next) => onChange(next as CountMode)}
      options={OPTIONS}
    />
  );
}
