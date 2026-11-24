import type { Size } from '@sabor/shared';
import type { PortionErrors, PortionValues } from '../../lib/portionPrices';
import { Card, CardContent } from '../ui/card';
import { NumberField } from '../ui/NumberField';
import { Select } from '../ui/Select';
import { SwitchField } from '../ui/Switch';
import { PortionPricesFields } from './PortionPricesFields';

interface PromoState {
  count: number | null;
  onCountChange: (value: number | null) => void;
  sizeId: number | null;
  onSizeIdChange: (value: number | null) => void;
  /** Solo tamaños de pizza: las presentaciones no son tamaños de promo. */
  sizes: Size[];
}

interface PortionState {
  /** Presentaciones disponibles; vacío = el negocio no las tiene configuradas. */
  portions: Size[];
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  values: PortionValues;
  onValueChange: (sizeId: number, price: number | null) => void;
  errors: PortionErrors;
}

interface SimplePriceSectionProps {
  categoryName: string;
  price: number | null;
  onPriceChange: (price: number | null) => void;
  portion: PortionState;
  promo: PromoState;
}

function PromoFields({ promo }: { promo: PromoState }) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <NumberField
        label="Pizzas incluidas (promo)"
        min={1}
        max={6}
        step={1}
        value={promo.count}
        onValueChange={promo.onCountChange}
        placeholder="Vacío = no es promo de pizzas"
        hint="En el POS se eligen los sabores de cada pizza; las que no son Clásicas suman la diferencia de precio."
      />
      <Select
        label="Tamaño de las pizzas de la promo"
        placeholder="Sin tamaño"
        value={promo.sizeId === null ? '' : String(promo.sizeId)}
        onValueChange={(next) => promo.onSizeIdChange(next === '' ? null : Number(next))}
        options={promo.sizes.map((size) => ({ value: String(size.id), label: size.labelEs }))}
      />
    </div>
  );
}

/**
 * Precio de un ítem de categoría SIN tamaños (BLUEPRINT §4.2): precio único, o por
 * presentaciones (Media docena, 1 docena…) con el interruptor. Las promos de pizzas
 * solo aplican al precio único.
 */
export function SimplePriceSection({ categoryName, price, onPriceChange, portion, promo }: SimplePriceSectionProps) {
  const canSellByPortions = portion.portions.length > 0;
  return (
    <Card>
      <CardContent className="gap-4 pt-5">
        {canSellByPortions && (
          <SwitchField
            label="Vender por presentaciones"
            description="Media docena, 1 docena, docena y media o 2 docenas, cada una con su precio."
            checked={portion.enabled}
            onCheckedChange={portion.onEnabledChange}
          />
        )}
        {portion.enabled ? (
          <PortionPricesFields
            portions={portion.portions}
            values={portion.values}
            onChange={portion.onValueChange}
            basePrice={price}
            onBasePriceChange={onPriceChange}
            errors={portion.errors}
          />
        ) : (
          <>
            <NumberField
              label="Precio"
              required
              min={0.01}
              value={price}
              onValueChange={onPriceChange}
              prefix="S/"
              placeholder="0.00"
              hint={`Los ítems de «${categoryName}» tienen precio propio único.`}
            />
            <PromoFields promo={promo} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
