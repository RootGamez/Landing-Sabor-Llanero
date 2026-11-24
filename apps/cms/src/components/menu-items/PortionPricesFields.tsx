import { useId } from 'react';
import { Layers, Wand2 } from 'lucide-react';
import type { Size } from '@sabor/shared';
import { formatPrice } from '../../lib/format';
import {
  basePortionOf,
  suggestPortionPrices,
  type PortionErrors,
  type PortionValues,
} from '../../lib/portionPrices';
import { NumberField } from '../ui/NumberField';
import { Button } from '../ui/Button';

interface PortionPricesFieldsProps {
  /** Presentaciones disponibles (Media docena, 1 docena…), ya en orden. */
  portions: Size[];
  values: PortionValues;
  onChange: (sizeId: number, price: number | null) => void;
  /** Precio base del ítem; solo se edita aquí si "1 docena" no está activa. */
  basePrice: number | null;
  onBasePriceChange: (price: number | null) => void;
  errors: PortionErrors;
}

/**
 * Precios por presentación de un ítem de categoría SIN tamaños (patrón de
 * `ItemPriceFields`): cada campo es opcional (vacío = no se ofrece) y muestra
 * como sugerencia el precio proporcional al de la docena. `price` del ítem sigue
 * siendo una sola fuente de verdad: el de "1 docena" si está activa, si no el base.
 */
export function PortionPricesFields({
  portions,
  values,
  onChange,
  basePrice,
  onBasePriceChange,
  errors,
}: PortionPricesFieldsProps) {
  const base = basePortionOf(portions);
  const dozenPrice = base ? (values.get(base.id) ?? null) : null;
  const dozenIsActive = dozenPrice != null && dozenPrice > 0;
  const suggestions = suggestPortionPrices(portions, dozenPrice, basePrice);
  const hasEmptyWithSuggestion = portions.some((p) => values.get(p.id) == null && suggestions.has(p.id));
  const generalErrorId = useId();

  function applySuggested() {
    for (const portion of portions) {
      const suggested = suggestions.get(portion.id);
      if (values.get(portion.id) == null && suggested !== undefined) onChange(portion.id, suggested);
    }
  }

  return (
    <fieldset
      className="flex flex-col gap-3 rounded-xl2 border-2 border-accent/40 bg-lime-soft/40 p-4"
      aria-describedby={errors.general ? generalErrorId : undefined}
    >
      <legend className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-forest">
        <Layers className="size-4" aria-hidden="true" />
        Precios por presentación
      </legend>

      <p className="text-xs text-text-muted">
        Deja vacía la presentación que no ofreces. El precio sugerido es proporcional al de la docena (la mitad, ×1,5 y
        ×2).
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        disabled={!hasEmptyWithSuggestion}
        onClick={applySuggested}
      >
        <Wand2 className="size-4" aria-hidden="true" />
        Usar sugeridos
      </Button>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {portions.map((portion) => {
          const suggested = suggestions.get(portion.id);
          const error = errors.fields.get(portion.id);
          return (
            <NumberField
              key={portion.id}
              label={portion.labelEs}
              hint={portion.detailEs || undefined}
              min={0.01}
              value={values.get(portion.id) ?? null}
              onValueChange={(next) => onChange(portion.id, next)}
              prefix="S/"
              placeholder={suggested !== undefined ? suggested.toFixed(2) : '0.00'}
              {...(error ? { error } : {})}
            />
          );
        })}
      </div>

      {dozenIsActive ? (
        <p className="text-xs text-text-muted">
          El precio base del ítem es el de «{base?.labelEs}» ({formatPrice(dozenPrice)}); se usa como referencia en
          listados.
        </p>
      ) : (
        <NumberField
          label="Precio base de referencia"
          required
          min={0.01}
          value={basePrice}
          onValueChange={onBasePriceChange}
          prefix="S/"
          placeholder="0.00"
          hint="Sin «1 docena» activa, este precio queda como referencia del ítem."
        />
      )}

      {errors.general && (
        <p id={generalErrorId} role="alert" className="text-sm font-medium text-destructive">
          {errors.general}
        </p>
      )}
    </fieldset>
  );
}
