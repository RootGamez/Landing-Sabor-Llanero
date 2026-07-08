import { Tag } from 'lucide-react';
import type { Size } from '@sabor/shared';
import { formatPrice } from '../../lib/format';
import type { CategoryWithPrices } from '../../lib/adminTypes';
import { NumberField } from '../ui/NumberField';
import { Badge } from '../ui/badge';
import { Button } from '../ui/Button';

interface ItemPriceFieldsProps {
  category: CategoryWithPrices;
  sizes: Size[];
  /** Override actual por sizeId; ausencia o null = hereda el precio de la categoría. */
  overrides: Map<number, number | null>;
  onOverrideChange: (sizeId: number, price: number | null) => void;
}

/**
 * Precios de un ítem de categoría CON tamaños (BLUEPRINT §4.2), patrón UX de
 * DiscountFields de Jaw: se muestra el precio heredado de la categoría por
 * cada tamaño y el admin puede sobreescribirlo. Vacío = heredado; con valor =
 * personalizado (badge visual para distinguirlos de un vistazo).
 */
export function ItemPriceFields({ category, sizes, overrides, onOverrideChange }: ItemPriceFieldsProps) {
  const basePriceBySize = new Map(category.prices.map((p) => [p.sizeId, p.price]));
  const hasAnyOverride = [...overrides.values()].some((v) => v != null);

  return (
    <div className="flex flex-col gap-3 rounded-xl2 border-2 border-accent/40 bg-lime-soft/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold font-display uppercase tracking-wide text-forest">
          <Tag className="size-4" />
          Precios por tamaño
        </div>
        {hasAnyOverride && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => sizes.forEach((size) => onOverrideChange(size.id, null))}
          >
            Volver a heredar todo
          </Button>
        )}
      </div>

      <p className="text-xs text-text-muted">
        Este ítem hereda los precios de la categoría «{category.nameEs}». Dejá un campo vacío para
        usar el precio heredado, o escribí un valor para personalizarlo solo en este ítem.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {sizes.map((size) => {
          const base = basePriceBySize.get(size.id);
          const override = overrides.get(size.id) ?? null;
          const isOverride = override != null;
          return (
            <div key={size.id} className="flex flex-col gap-1.5">
              <NumberField
                label={size.labelEs}
                min={0.01}
                value={override}
                onValueChange={(v) => onOverrideChange(size.id, v)}
                prefix="S/"
                placeholder={base != null ? String(base) : '—'}
              />
              <div className="flex items-center gap-2">
                <Badge variant={isOverride ? 'accent' : 'muted'} className="w-fit">
                  {isOverride ? 'Personalizado' : 'Heredado'}
                </Badge>
                <span className="text-xs text-text-muted">
                  {isOverride && base != null
                    ? `Categoría: ${formatPrice(base)}`
                    : base != null
                      ? formatPrice(base)
                      : 'Sin precio en la categoría'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
