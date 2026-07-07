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
import type { Category, CategoryPrice, ItemPrice, MenuItem, ResolvedPrice, Size } from './types';

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
