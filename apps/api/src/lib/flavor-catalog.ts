import { buildFlavorCatalog, resolveItemPrices, type FlavorPricingCatalog, type MenuChannel } from '@sabor/shared';
import {
  mapCategory,
  mapCategoryPrice,
  mapItemPrice,
  mapSize,
  type CategoryPriceRow,
  type CategoryRow,
  type ItemPriceRow,
  type MenuItemRow,
  type SizeRow,
} from '../db/rows';
import { channelCondition } from './menu-channel';

/**
 * Catálogo de sabores para tasar en el servidor: pizzas ACTIVAS (categoría
 * activa con tamaños, ítem activo y vendible en `channels`) con su precio
 * resuelto por tamaño (override o herencia), y el precio de lista de cada
 * categoría de pizzas. 5 queries en paralelo, sin N+1. Lo que no está acá
 * (inactivo, solo-web, no-pizza) se rechaza como sabor inválido.
 */
export async function loadFlavorCatalog(db: D1Database, channels: readonly MenuChannel[]): Promise<FlavorPricingCatalog> {
  const channel = channelCondition(channels, 'mi.channel');
  const [categories, categoryPrices, items, itemPrices, sizes] = await Promise.all([
    db.prepare('SELECT * FROM categories WHERE has_sizes = 1').all<CategoryRow>(),
    db
      .prepare('SELECT cp.* FROM category_prices cp JOIN categories c ON c.id = cp.category_id WHERE c.has_sizes = 1')
      .all<CategoryPriceRow>(),
    db
      .prepare(
        `SELECT mi.* FROM menu_items mi JOIN categories c ON c.id = mi.category_id
          WHERE c.has_sizes = 1 AND c.is_active = 1 AND mi.is_active = 1 AND ${channel.sql}`,
      )
      .bind(...channel.params)
      .all<MenuItemRow>(),
    db
      .prepare(
        `SELECT ip.* FROM item_prices ip JOIN menu_items mi ON mi.id = ip.item_id
           JOIN categories c ON c.id = mi.category_id WHERE c.has_sizes = 1`,
      )
      .all<ItemPriceRow>(),
    db.prepare('SELECT * FROM sizes ORDER BY display_order ASC').all<SizeRow>(),
  ]);

  const sizeList = sizes.results.map(mapSize);
  const prices = categoryPrices.results.map(mapCategoryPrice);
  const overrides = itemPrices.results.map(mapItemPrice);
  const categoryById = new Map(categories.results.map((row) => [row.id, mapCategory(row)]));

  return buildFlavorCatalog(
    categories.results.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name_es,
      hasSizes: row.has_sizes === 1,
      listPrices: prices.filter((p) => p.categoryId === row.id).map(({ sizeId, price }) => ({ sizeId, price })),
    })),
    items.results.flatMap((row) => {
      const category = categoryById.get(row.category_id);
      if (!category) return [];
      const resolved = resolveItemPrices({ id: row.id }, category, sizeList, prices, overrides);
      return [{ id: row.id, name: row.name_es, categoryId: row.category_id, prices: resolved.map(({ sizeId, price }) => ({ sizeId, price })) }];
    }),
  );
}
