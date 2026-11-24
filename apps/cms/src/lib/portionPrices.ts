/**
 * Lógica pura del formulario de presentaciones de un ítem (Media docena, 1 docena…):
 * sugerencia proporcional, armado del payload y validación por campo.
 */
import type { Size } from '@sabor/shared';

/** Unidades de la presentación que fija el precio base del ítem ("1 docena"). */
export const BASE_PORTION_UNITS = 12;

/** Precio por presentación; `null` = el ítem no ofrece esa presentación. */
export type PortionValues = ReadonlyMap<number, number | null>;

export interface PortionErrors {
  /** Error por `sizeId` de presentación. */
  fields: ReadonlyMap<number, string>;
  /** Error que no es de un campo (p. ej. ninguna presentación activa). */
  general: string | null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Presentación activa = con precio cargado (> 0). */
function isActive(price: number | null | undefined): price is number {
  return price != null && price > 0;
}

/** Id de la presentación base ("1 docena"), si existe. */
export function basePortionOf(portions: readonly Size[]): Size | undefined {
  return portions.find((portion) => portion.units === BASE_PORTION_UNITS);
}

/**
 * Precio sugerido de cada presentación, proporcional a las unidades, a partir del
 * precio de la docena (o del precio base si la docena aún no tiene). Vacío si no hay referencia.
 */
export function suggestPortionPrices(
  portions: readonly Size[],
  dozenPrice: number | null,
  basePrice: number | null,
): Map<number, number> {
  const reference = isActive(dozenPrice) ? dozenPrice : isActive(basePrice) ? basePrice : null;
  const suggestions = new Map<number, number>();
  if (reference === null) return suggestions;
  for (const portion of portions) {
    if (!portion.units) continue;
    suggestions.set(portion.id, round2((reference * portion.units) / BASE_PORTION_UNITS));
  }
  return suggestions;
}

/** `priceOverrides` del contrato: solo las presentaciones activas. */
export function toPortionOverrides(values: PortionValues): Array<{ sizeId: number; price: number }> {
  return [...values.entries()]
    .filter((entry): entry is [number, number] => isActive(entry[1]))
    .map(([sizeId, price]) => ({ sizeId, price }));
}

/** Precio del ítem (`price`): el de "1 docena" si está activa; si no, el base de referencia. */
export function resolveItemPrice(values: PortionValues, basePortionId: number | undefined, basePrice: number | null): number | null {
  const dozen = basePortionId === undefined ? null : values.get(basePortionId);
  return isActive(dozen) ? dozen : basePrice;
}

/** Valida las presentaciones: al menos una activa y todos los precios cargados > 0. */
export function validatePortions(values: PortionValues): PortionErrors {
  const fields = new Map<number, string>();
  for (const [sizeId, price] of values) {
    if (price != null && !(price > 0)) fields.set(sizeId, 'El precio debe ser mayor a 0.');
  }
  const general = toPortionOverrides(values).length === 0 ? 'Activa al menos una presentación con su precio.' : null;
  return { fields, general };
}
