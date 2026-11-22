/**
 * Catálogo del POS: aplana las secciones de `/menu-items/sections?channel=pos`
 * en productos con sus opciones de venta (tamaño + precio en céntimos). Los
 * precios ya vienen resueltos por la API (herencia/override, BLUEPRINT §4.2).
 */
import { toCents, type Category, type MenuItemWithPrices, type Size } from '@sabor/shared';
import type { PriceSource } from './posCart';

/** Tope de ítems por categoría que devuelve la API de secciones. */
export const POS_SECTION_ITEM_LIMIT = 24;

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
  };
}

export function buildCatalog(sections: readonly PosMenuSection[], sizes: readonly Size[]): PosCatalog {
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
  return { categories, products, truncatedCategories };
}

/** Busca la opción vigente de un producto/tamaño (para re-preciar un carrito restaurado). */
export function priceLookup(catalog: PosCatalog) {
  const productById = new Map(catalog.products.map((product) => [product.id, product]));
  return (itemId: number, sizeId: number | null): PriceSource | undefined => {
    const product = productById.get(itemId);
    const option = product?.options.find((candidate) => candidate.sizeId === sizeId);
    if (!product || !option) return undefined;
    return { name: product.name, sizeLabel: option.label, unitPriceCents: option.priceCents };
  };
}

/** Precio mostrado en el botón: el único, o "desde" el menor si hay varios tamaños. */
export function displayPrice(product: PosProduct): { cents: number; isFrom: boolean } | null {
  if (product.options.length === 0) return null;
  const cents = Math.min(...product.options.map((option) => option.priceCents));
  return { cents, isFrom: product.options.length > 1 };
}
