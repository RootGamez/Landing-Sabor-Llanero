import type { Size, SizePriceInput } from '@sabor/shared';
import { NumberField } from '../ui/NumberField';

interface SizePricesEditorProps {
  sizes: Size[];
  /** Precio actual por sizeId (null = sin definir todavía). */
  values: Map<number, number | null>;
  onChange: (sizeId: number, price: number | null) => void;
}

/**
 * Editor de precios por tamaño de una categoría (BLUEPRINT §4.2): un campo
 * por cada tamaño del negocio, todos obligatorios (la API exige cobertura
 * completa vía assertFullSizeCoverage).
 */
export function SizePricesEditor({ sizes, values, onChange }: SizePricesEditorProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {sizes.map((size) => (
        <NumberField
          key={size.id}
          label={size.labelEs}
          hint={size.detailEs || undefined}
          required
          min={0.01}
          value={values.get(size.id) ?? null}
          onValueChange={(v) => onChange(size.id, v)}
          prefix="S/"
          placeholder="0.00"
        />
      ))}
    </div>
  );
}

/** Convierte el Map del editor en el array `prices` del contrato (omite vacíos). */
export function toSizePriceInputs(values: Map<number, number | null>): SizePriceInput[] {
  return [...values.entries()]
    .filter((entry): entry is [number, number] => entry[1] != null && entry[1] > 0)
    .map(([sizeId, price]) => ({ sizeId, price }));
}
