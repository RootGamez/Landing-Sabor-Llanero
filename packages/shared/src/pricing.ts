/**
 * Resolución pura de precios (BLUEPRINT §4.2), equivalente conceptual de
 * discount.ts en Jaw pero para el modelo categoría/tamaño de la pizzería:
 *
 *   precioDe(item, size):
 *     si item.category.hasSizes:
 *       → itemPrices[item, size] ?? categoryPrices[category, size]  // override o herencia
 *     si no:
 *       → item.price                                                 // precio propio único
 *
 * Funciones puras, sin acceso a DB: la API las usa para responder
 * `MenuItemDetail` con los precios YA resueltos (el público nunca calcula),
 * y el CMS las reusa para el preview del formulario ("heredado" vs
 * "personalizado").
 */
import type { Category, CategoryPrice, ItemPrice, MenuItem, ResolvedPrice, Size, SizeKind } from './types';

/**
 * Resuelve el precio de un ítem para cada tamaño de la lista dada
 * (normalmente los tamaños activos del negocio). Solo tiene sentido si
 * `category.hasSizes` es true; si no, devuelve `[]` (usar
 * `resolveSimplePrice` en ese caso).
 *
 * Un tamaño sin precio de categoría NI override se omite del resultado en
 * vez de reventar: indica una categoría mal configurada (le falta un precio
 * para ese tamaño), que la validación de `createCategorySchema` debería
 * haber evitado, pero esta función no asume que los datos ya persistidos
 * son perfectos.
 */
export function resolveItemPrices(
  item: Pick<MenuItem, 'id'>,
  category: Pick<Category, 'id' | 'hasSizes'>,
  sizes: Size[],
  categoryPrices: CategoryPrice[],
  itemPrices: ItemPrice[],
): ResolvedPrice[] {
  if (!category.hasSizes) return [];

  const overrideBySize = new Map(itemPrices.filter((p) => p.itemId === item.id).map((p) => [p.sizeId, p]));
  const baseBySize = new Map(categoryPrices.filter((p) => p.categoryId === category.id).map((p) => [p.sizeId, p]));

  const resolved: ResolvedPrice[] = [];
  for (const size of sizes) {
    // Las presentaciones (0012) no son tamaños de pizza: nunca entran acá.
    if (kindOf(size) === 'portion') continue;
    const override = overrideBySize.get(size.id);
    const base = baseBySize.get(size.id);
    const source = override ?? base;
    if (!source) continue;
    resolved.push({
      sizeId: size.id,
      sizeKey: size.key,
      price: round2(source.price),
      isOverride: override != null,
    });
  }
  return resolved;
}

/** Tipo efectivo de una fila de `sizes`; ausente (datos previos a 0012) = 'size'. */
export function kindOf(size: Pick<Size, 'kind'>): SizeKind {
  return size.kind ?? 'size';
}

/**
 * Presentaciones (Media docena, 1 docena…) con precio propio de un ítem de
 * categoría SIN tamaños, en orden de exhibición. Solo las que tienen fila en
 * `item_prices` (el dueño elige cuáles ofrece cada ítem); `[]` si el ítem se
 * vende solo con su `price` único. `price` queda como respaldo/"desde".
 */
export function resolvePortionPrices(
  item: Pick<MenuItem, 'id'>,
  itemPrices: ItemPrice[],
  sizes: Size[],
): ResolvedPrice[] {
  const priceBySize = new Map(itemPrices.filter((p) => p.itemId === item.id).map((p) => [p.sizeId, p]));
  return sizes
    .filter((size) => kindOf(size) === 'portion' && priceBySize.has(size.id))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
    .map((size) => ({
      sizeId: size.id,
      sizeKey: size.key,
      price: round2(priceBySize.get(size.id)!.price),
      isOverride: true,
      kind: 'portion' as const,
      units: size.units ?? null,
      labelEs: size.labelEs,
      labelEn: size.labelEn,
    }));
}

/**
 * Valida que los overrides de precio de un ítem sean del tipo que corresponde
 * a su categoría: tamaños (`kind = 'size'`) si la categoría vende por tamaño,
 * presentaciones (`'portion'`) si no. Devuelve el mensaje de error (en español,
 * apto para un 400) o `null` si todo es válido. Pura: la API le pasa las
 * filas de `sizes`; así tamaños y presentaciones nunca se mezclan.
 */
export function assertOverrideKinds(
  overrides: ReadonlyArray<{ sizeId: number }>,
  sizes: Size[],
  categoryHasSizes: boolean,
): string | null {
  const wanted: SizeKind = categoryHasSizes ? 'size' : 'portion';
  const noun = categoryHasSizes ? 'tamaños' : 'presentaciones';
  const kindById = new Map(sizes.map((size) => [size.id, kindOf(size)]));
  const ids = [...new Set(overrides.map((entry) => entry.sizeId))];
  const unknown = ids.filter((id) => !kindById.has(id));
  if (unknown.length > 0) return `sizeId inválido: no existe(n) ${unknown.join(', ')}`;
  const wrong = ids.filter((id) => kindById.get(id) !== wanted);
  if (wrong.length > 0) {
    return `sizeId inválido: ${wrong.join(', ')} no son ${noun} (esta categoría ${
      categoryHasSizes ? 'vende por tamaño' : 'solo admite presentaciones'
    })`;
  }
  return null;
}

/**
 * Precio de un ítem de categoría SIN tamaños (precio propio único). Devuelve
 * 0 si `price` es null: la validación exige `price` obligatorio para estas
 * categorías (BLUEPRINT §4.2), así que este caso no debería llegar a
 * producción, pero se evita propagar `null`/`NaN` a la UI si igual ocurre.
 */
export function resolveSimplePrice(item: Pick<MenuItem, 'price'>): number {
  return item.price != null ? round2(item.price) : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Porcentaje de descuento entero (redondeado) de un premio con discountPrice.
 * null si no hay descuento válido — pura y compartida para que la UI de
 * premios (web) y cualquier preview del CMS calculen el mismo número.
 */
export function rewardDiscountPercent(price: number, discountPrice: number | null): number | null {
  if (discountPrice == null || discountPrice <= 0 || discountPrice >= price) return null;
  return Math.round((1 - discountPrice / price) * 100);
}
