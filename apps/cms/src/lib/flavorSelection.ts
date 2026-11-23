/**
 * Estado puro del selector de sabores del POS (sin React ni red): qué sabores
 * van en cada pizza, qué opciones se muestran y el precio en vivo. El precio
 * usa la MISMA función que el servidor (`priceFlavoredLine` de @sabor/shared),
 * así que lo que ve el cajero coincide con lo que se cobra; el servidor igual
 * re-tasa y valida al registrar.
 */
import {
  FlavorPricingError,
  MAX_FLAVORS_PER_PIZZA,
  formatPEN,
  priceFlavoredLine,
  type FlavorPriceResult,
  type FlavorPricingCatalog,
  type FlavorTarget,
} from '@sabor/shared';
import { normalizeText, type PosCategory } from './posCatalog';

export type Selection = readonly (readonly number[])[];

/** Selección inicial: la pizza arranca con su propio sabor (fijo); la promo con sus pizzas vacías. */
export function initialSelection(target: FlavorTarget, existing: Selection | null | undefined): number[][] {
  if (existing && existing.length > 0) return existing.map((pizza) => [...pizza]);
  if (target.kind === 'pizza') return [[target.itemId]];
  return Array.from({ length: target.pizzaCount }, () => []);
}

/** Sabor que no se puede quitar: el de la pizza del ticket (la línea es "Pizza Hawaiana"). */
export function fixedFlavor(target: FlavorTarget): number | null {
  return target.kind === 'pizza' ? target.itemId : null;
}

/**
 * Tocar un sabor: si ya está en la pizza activa, se quita (salvo el fijo); si
 * hay lugar, se agrega; si la pizza está llena, reemplaza el último elegido
 * (lo más rápido con una mano: no obliga a quitar primero).
 */
export function toggleFlavor(selection: Selection, pizzaIndex: number, flavorId: number, fixed: number | null): number[][] {
  return selection.map((pizza, index) => {
    if (index !== pizzaIndex) return [...pizza];
    if (pizza.includes(flavorId)) return flavorId === fixed ? [...pizza] : pizza.filter((id) => id !== flavorId);
    if (pizza.length < MAX_FLAVORS_PER_PIZZA) return [...pizza, flavorId];
    const replaceable = pizza.length - 1;
    if (pizza[replaceable] === fixed) return [...pizza];
    return [...pizza.slice(0, replaceable), flavorId];
  });
}

export function removeFlavor(selection: Selection, pizzaIndex: number, flavorId: number, fixed: number | null): number[][] {
  if (flavorId === fixed) return selection.map((pizza) => [...pizza]);
  return selection.map((pizza, index) => (index === pizzaIndex ? pizza.filter((id) => id !== flavorId) : [...pizza]));
}

/** Tras elegir: si quedó una pizza sin sabor, se pasa a ella; si no, se queda en la actual. */
export function nextActivePizza(selection: Selection, current: number): number {
  const currentPizza = selection[current];
  if (currentPizza && currentPizza.length === 0) return current;
  const empty = selection.findIndex((pizza) => pizza.length === 0);
  return empty === -1 ? current : empty;
}

export interface FlavorOption {
  itemId: number;
  name: string;
  /** Precio de esa pizza en el tamaño (pizza individual). */
  priceCents: number;
  /** Adicional sobre Clásicas en ese tamaño (promos); 0 si no aplica o no se pudo calcular. */
  surchargeCents: number;
  searchText: string;
}

export interface FlavorGroup {
  category: PosCategory;
  options: FlavorOption[];
}

/** Sabores con precio en el tamaño, agrupados por categoría en el orden del POS. */
export function flavorGroups(
  catalog: FlavorPricingCatalog,
  categories: readonly PosCategory[],
  sizeId: number,
): FlavorGroup[] {
  const base = catalog.baseCategoryId === null ? undefined : catalog.categories.get(catalog.baseCategoryId);
  const basePrice = base?.listPriceCentsBySize[sizeId];
  return categories.flatMap((category) => {
    const info = catalog.categories.get(category.id);
    if (!info) return [];
    const ownList = info.listPriceCentsBySize[sizeId];
    const surchargeCents = basePrice !== undefined && ownList !== undefined ? Math.max(0, ownList - basePrice) : 0;
    const options = [...catalog.flavors.values()]
      .filter((flavor) => flavor.categoryId === category.id && (flavor.priceCentsBySize[sizeId] ?? 0) > 0)
      .map((flavor) => ({
        itemId: flavor.itemId,
        name: flavor.name,
        priceCents: flavor.priceCentsBySize[sizeId] ?? 0,
        surchargeCents,
        searchText: normalizeText(`${flavor.name} ${category.name}`),
      }));
    return options.length > 0 ? [{ category, options }] : [];
  });
}

export function searchFlavors(groups: readonly FlavorGroup[], query: string): FlavorOption[] {
  const needle = normalizeText(query);
  if (!needle) return [];
  return groups.flatMap((group) => group.options.filter((option) => option.searchText.includes(needle)));
}

export type LivePrice =
  | { ok: true; result: FlavorPriceResult; explanation: string[] }
  | { ok: false; message: string };

/** Precio en vivo (sin red) o qué falta elegir. */
export function livePrice(target: FlavorTarget, selection: Selection, catalog: FlavorPricingCatalog): LivePrice {
  const missing = selection.findIndex((pizza) => pizza.length === 0);
  if (missing !== -1) {
    return { ok: false, message: selection.length > 1 ? `Elige el sabor de la Pizza ${missing + 1}` : 'Elige un sabor' };
  }
  try {
    const result = priceFlavoredLine(target, selection, catalog);
    return { ok: true, result, explanation: explainPrice(target, result) };
  } catch (err) {
    if (err instanceof FlavorPricingError) return { ok: false, message: err.message };
    throw err;
  }
}

/** "Se cobra el precio de Llanera" / "+S/ 2.00 adicional Pizzas Especiales (Pizza 1)". */
export function explainPrice(target: FlavorTarget, result: FlavorPriceResult): string[] {
  if (target.kind === 'pizza') {
    const [pizza] = result.pizzas;
    if (!pizza || pizza.flavors.length < 2) return [];
    return [`Se cobra el precio de ${pizza.pricedBy.name}`];
  }
  const lines = [`Promo ${formatPEN(target.basePriceCents)}`];
  result.pizzas.forEach((pizza, index) => {
    if (pizza.surchargeCents > 0) {
      lines.push(`+${formatPEN(pizza.surchargeCents)} adicional ${pizza.categoryName} (Pizza ${index + 1})`);
    }
  });
  if (lines.length === 1) lines.push('Todas Clásicas: sin adicional');
  return lines;
}
