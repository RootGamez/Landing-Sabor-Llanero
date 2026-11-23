/**
 * Navegación de la cuadrícula del POS: categorías -> productos de la categoría.
 * Funciones puras (sin React) para poder probarlas. Una búsqueda con texto
 * ignora la categoría activa y devuelve resultados globales.
 */
import { normalizeText, type PosCatalog, type PosCategory, type PosProduct } from './posCatalog';

/** `null` = vista de categorías (inicio). */
export type ActiveCategory = number | null;

export type GridView =
  | { kind: 'categories'; categories: readonly CategoryTile[] }
  | { kind: 'products'; category: PosCategory; products: readonly PosProduct[] }
  | { kind: 'search'; products: readonly PosProduct[] };

export interface CategoryTile {
  category: PosCategory;
  productCount: number;
}

/** Cuenta productos por categoría conservando el orden de la carta; las categorías sin productos no aparecen. */
export function buildCategoryTiles(catalog: PosCatalog): CategoryTile[] {
  const counts = new Map<number, number>();
  for (const product of catalog.products) {
    counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
  }
  return catalog.categories
    .map((category) => ({ category, productCount: counts.get(category.id) ?? 0 }))
    .filter((tile) => tile.productCount > 0);
}

/** Productos de una categoría; un id desconocido da lista vacía. */
export function productsInCategory(catalog: PosCatalog, categoryId: number): PosProduct[] {
  return catalog.products.filter((product) => product.categoryId === categoryId);
}

/** Búsqueda global por nombre/categoría (sin tildes ni mayúsculas). Texto vacío = sin resultados de búsqueda. */
export function searchProducts(catalog: PosCatalog, query: string): PosProduct[] {
  const needle = normalizeText(query);
  if (!needle) return [];
  return catalog.products.filter((product) => product.searchText.includes(needle));
}

/** Suma las unidades del ticket por categoría (para el indicador de las categorías). */
export function unitsByCategory(
  catalog: PosCatalog,
  unitsByProduct: ReadonlyMap<number, number>,
): Map<number, number> {
  const totals = new Map<number, number>();
  for (const product of catalog.products) {
    const units = unitsByProduct.get(product.id) ?? 0;
    if (units > 0) totals.set(product.categoryId, (totals.get(product.categoryId) ?? 0) + units);
  }
  return totals;
}

/** Decide qué muestra la cuadrícula. Una categoría activa que ya no existe vuelve al inicio. */
export function resolveGridView(catalog: PosCatalog, active: ActiveCategory, query: string): GridView {
  if (normalizeText(query)) return { kind: 'search', products: searchProducts(catalog, query) };
  const category = active === null ? undefined : catalog.categories.find((item) => item.id === active);
  if (!category) return { kind: 'categories', categories: buildCategoryTiles(catalog) };
  return { kind: 'products', category, products: productsInCategory(catalog, category.id) };
}
