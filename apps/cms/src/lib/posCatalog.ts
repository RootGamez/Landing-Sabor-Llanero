/**
 * Catálogo del POS: aplana las secciones de `/menu-items/sections?channel=pos`
 * en productos con sus opciones de venta (tamaño + precio en céntimos). Los
 * precios ya vienen resueltos por la API (herencia/override, BLUEPRINT §4.2).
 */
import {
  FlavorPricingError,
  buildFlavorCatalog,
  priceFlavoredLine,
  toCents,
  type Category,
  type CategoryPrice,
  type FlavorPricingCatalog,
  type FlavorTarget,
  type MenuItemWithPrices,
  type Size,
} from '@sabor/shared';
import type { CartLine, PriceSource } from './posCart';

/** Categoría con sus precios de lista por tamaño (`GET /categories`), base del adicional de promos. */
export type CategoryWithPrices = Category & { prices: CategoryPrice[] };

/** Promo con pizzas a elegir: cuántas y de qué tamaño. */
export interface PosPromo {
  pizzaCount: number;
  sizeId: number;
  sizeLabel: string;
}

/** Tope de ítems por categoría que devuelve la API de secciones para el mostrador (`channel=pos`). */
export const POS_SECTION_ITEM_LIMIT = 200;

export interface PosMenuSection {
  category: Category;
  items: MenuItemWithPrices[];
}

/** Una forma de vender un producto: sin tamaño (`sizeId` null) o un tamaño concreto. */
export interface PosOption {
  sizeId: number | null;
  label: string | null;
  priceCents: number;
}

export interface PosProduct {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  colorIndex: number;
  /** Vacío = sin precio configurado: no se puede vender. */
  options: PosOption[];
  searchText: string;
  /** Pizza vendida por tamaño: admite "Agregar sabores" (hasta MAX_FLAVORS_PER_PIZZA). */
  isPizza?: boolean;
  /** Promo con pizzas a elegir (null/ausente si no aplica). */
  promo?: PosPromo | null;
}

export interface PosCategory {
  id: number;
  name: string;
  colorIndex: number;
}

export interface PosCatalog {
  categories: PosCategory[];
  products: PosProduct[];
  /** Nombres de categorías que llegaron al tope de la API y podrían tener más productos. */
  truncatedCategories: string[];
  /** Sabores (pizzas) y precios de lista: el precio en vivo se calcula sin red. */
  flavorCatalog?: FlavorPricingCatalog;
}

const EMPTY_FLAVOR_CATALOG: FlavorPricingCatalog = { flavors: new Map(), categories: new Map(), baseCategoryId: null };

/** Catálogo de sabores del POS (vacío si no se armó). */
export function flavorCatalogOf(catalog: PosCatalog): FlavorPricingCatalog {
  return catalog.flavorCatalog ?? EMPTY_FLAVOR_CATALOG;
}

/** Minúsculas y sin tildes: "Piña" coincide con "pina". */
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function safeCents(soles: number | null): number {
  if (soles === null || !(soles > 0)) return 0;
  try {
    return toCents(soles);
  } catch {
    return 0;
  }
}

function optionsFor(item: MenuItemWithPrices, category: Category, sizeById: Map<number, Size>): PosOption[] {
  if (!category.hasSizes) {
    const priceCents = safeCents(item.price);
    return priceCents > 0 ? [{ sizeId: null, label: null, priceCents }] : [];
  }
  return item.prices
    .map((price) => ({
      sizeId: price.sizeId,
      label: sizeById.get(price.sizeId)?.labelEs ?? price.sizeKey,
      priceCents: safeCents(price.price),
    }))
    .filter((option) => option.priceCents > 0);
}

function toProduct(
  item: MenuItemWithPrices,
  category: PosCategory,
  source: Category,
  sizeById: Map<number, Size>,
): PosProduct {
  return {
    id: item.id,
    name: item.nameEs,
    categoryId: category.id,
    categoryName: category.name,
    colorIndex: category.colorIndex,
    options: optionsFor(item, source, sizeById),
    searchText: normalizeText(`${item.nameEs} ${category.name}`),
    isPizza: source.hasSizes,
    promo: promoFor(item, source, sizeById),
  };
}

function promoFor(item: MenuItemWithPrices, category: Category, sizeById: Map<number, Size>): PosPromo | null {
  const { promoPizzaCount, promoPizzaSizeId } = item;
  if (category.hasSizes || !promoPizzaCount || !promoPizzaSizeId) return null;
  const size = sizeById.get(promoPizzaSizeId);
  if (!size) return null;
  return { pizzaCount: promoPizzaCount, sizeId: size.id, sizeLabel: size.labelEs };
}

/** Sabores de pizzas con precio resuelto; las categorías de lista vienen de `/categories` (si no llegó, sin adicionales). */
function flavorCatalogFor(sections: readonly PosMenuSection[], categories: readonly CategoryWithPrices[]): FlavorPricingCatalog {
  const listById = new Map(categories.map((category) => [category.id, category.prices]));
  return buildFlavorCatalog(
    sections.map(({ category }) => ({
      id: category.id,
      slug: category.slug,
      name: category.nameEs,
      hasSizes: category.hasSizes,
      listPrices: (listById.get(category.id) ?? []).map(({ sizeId, price }) => ({ sizeId, price })),
    })),
    sections.flatMap(({ items }) =>
      items.map((item) => ({ id: item.id, name: item.nameEs, categoryId: item.categoryId, prices: item.prices })),
    ),
  );
}

/** Cómo se tasan los sabores de un producto del POS (null si no admite sabores). */
export function flavorTargetOf(product: PosProduct, sizeId: number | null): FlavorTarget | null {
  if (product.isPizza) return sizeId === null ? null : { kind: 'pizza', itemId: product.id, sizeId };
  const [only] = product.options;
  if (!product.promo || !only) return null;
  return {
    kind: 'promo',
    itemId: product.id,
    basePriceCents: only.priceCents,
    pizzaCount: product.promo.pizzaCount,
    sizeId: product.promo.sizeId,
  };
}

export function buildCatalog(
  sections: readonly PosMenuSection[],
  sizes: readonly Size[],
  listCategories: readonly CategoryWithPrices[] = [],
): PosCatalog {
  const sizeById = new Map(sizes.map((size) => [size.id, size]));
  const categories: PosCategory[] = [];
  const products: PosProduct[] = [];
  const truncatedCategories: string[] = [];

  sections.forEach((section, index) => {
    if (section.items.length === 0) return;
    const category: PosCategory = { id: section.category.id, name: section.category.nameEs, colorIndex: index };
    categories.push(category);
    if (section.items.length >= POS_SECTION_ITEM_LIMIT) truncatedCategories.push(category.name);
    for (const item of section.items) {
      products.push(toProduct(item, category, section.category, sizeById));
    }
  });
  return { categories, products, truncatedCategories, flavorCatalog: flavorCatalogFor(sections, listCategories) };
}

/**
 * Busca la opción vigente de un producto/tamaño (para re-preciar un carrito
 * restaurado). Si la línea tiene sabores, los re-tasa con el catálogo actual;
 * si alguno ya no es válido, la línea se considera no disponible.
 */
export function priceLookup(catalog: PosCatalog) {
  const productById = new Map(catalog.products.map((product) => [product.id, product]));
  return (itemId: number, sizeId: number | null, line?: CartLine): PriceSource | undefined => {
    const product = productById.get(itemId);
    const option = product?.options.find((candidate) => candidate.sizeId === sizeId);
    if (!product || !option) return undefined;
    const base = { name: product.name, sizeLabel: option.label, unitPriceCents: option.priceCents };
    if (!line?.flavors || line.flavors.length === 0) return base;
    const target = flavorTargetOf(product, sizeId);
    if (!target) return undefined;
    try {
      const priced = priceFlavoredLine(target, line.flavors, flavorCatalogOf(catalog));
      return { ...base, unitPriceCents: priced.unitPriceCents, flavorInfo: { kind: target.kind, pizzas: priced.pizzas } };
    } catch (err) {
      if (err instanceof FlavorPricingError) return undefined;
      throw err;
    }
  };
}

/** Precio mostrado en el botón: el único, o "desde" el menor si hay varios tamaños. */
export function displayPrice(product: PosProduct): { cents: number; isFrom: boolean } | null {
  if (product.options.length === 0) return null;
  const cents = Math.min(...product.options.map((option) => option.priceCents));
  return { cents, isFrom: product.options.length > 1 };
}
