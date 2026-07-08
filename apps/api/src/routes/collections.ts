import { Hono } from 'hono';
import {
  COLLECTION_KEYS,
  replaceCollectionItemsSchema,
  resolveItemPrices,
  resolveSimplePrice,
  updateCollectionSchema,
  type Category,
  type CategoryPrice,
  type Collection,
  type CollectionKey,
  type CollectionWithItems,
  type ItemPrice,
  type MenuItemWithPrices,
  type Size,
} from '@sabor/shared';
import type { AppEnv } from '../env';
import type { CategoryPriceRow, CategoryRow, CollectionRow, ItemPriceRow, MenuItemRow, SizeRow } from '../db/rows';
import { mapCategory, mapCategoryPrice, mapCollection, mapItemPrice, mapMenuItem, mapSize } from '../db/rows';
import { coverKeysByItem } from '../db/covers';
import { requireAuth, requireRole } from '../middleware/auth';
import { badRequest, notFound } from '../lib/http-error';
import { parseBody } from '../lib/validate';

export const collectionRoutes = new Hono<AppEnv>();

/** true si `key` es una de las 3 colecciones fijas del negocio (COLLECTION_KEYS). */
function isCollectionKey(key: string): key is CollectionKey {
  return (COLLECTION_KEYS as readonly string[]).includes(key);
}

interface LoadCollectionsOptions {
  /** Si se omite, carga todas las colecciones (filtradas por includeInactiveCollections). */
  collectionIds?: number[];
  includeInactiveCollections: boolean;
  includeInactiveItems: boolean;
}

/**
 * Carga colecciones con sus ítems ya resueltos (precios + portada), sin N+1:
 * una query para las colecciones, una (JOIN) para sus ítems, y el resto en
 * bloque (categorías, category_prices, item_prices, tamaños, portadas) —
 * mismo patrón que GET /menu-items/sections. Reusada por los 3 endpoints de
 * este módulo (público, admin, y la respuesta de PUT /:key/items).
 */
async function loadCollections(
  db: D1Database,
  opts: LoadCollectionsOptions,
): Promise<CollectionWithItems[]> {
  let collectionRows: CollectionRow[];
  if (opts.collectionIds) {
    if (opts.collectionIds.length === 0) return [];
    const placeholders = opts.collectionIds.map(() => '?').join(',');
    collectionRows = (
      await db
        .prepare(`SELECT * FROM collections WHERE id IN (${placeholders}) ORDER BY display_order ASC, id ASC`)
        .bind(...opts.collectionIds)
        .all<CollectionRow>()
    ).results;
  } else {
    collectionRows = (
      await db
        .prepare(
          opts.includeInactiveCollections
            ? 'SELECT * FROM collections ORDER BY display_order ASC, id ASC'
            : 'SELECT * FROM collections WHERE is_active = 1 ORDER BY display_order ASC, id ASC',
        )
        .all<CollectionRow>()
    ).results;
  }
  const collectionIds = collectionRows.map((r) => r.id);
  if (collectionIds.length === 0) return collectionRows.map((r) => ({ ...mapCollection(r), items: [] }));

  const collectionPlaceholders = collectionIds.map(() => '?').join(',');
  const itemFilter = opts.includeInactiveItems ? '' : 'AND mi.is_active = 1';
  const { results: itemRows } = await db
    .prepare(
      `SELECT ci.collection_id AS collection_id, ci.display_order AS collection_item_order, mi.*
         FROM collection_items ci
         JOIN menu_items mi ON mi.id = ci.item_id
        WHERE ci.collection_id IN (${collectionPlaceholders}) ${itemFilter}
        ORDER BY ci.collection_id ASC, ci.display_order ASC, ci.id ASC`,
    )
    .bind(...collectionIds)
    .all<MenuItemRow & { collection_id: number; collection_item_order: number }>();

  const categoryIds = [...new Set(itemRows.map((r) => r.category_id))];
  const itemIds = itemRows.map((r) => r.id);

  const [categoryRowsResult, categoryPriceRowsResult, itemPriceRowsResult, sizeRowsResult, coverByItem] =
    await Promise.all([
      categoryIds.length
        ? db
            .prepare(`SELECT * FROM categories WHERE id IN (${categoryIds.map(() => '?').join(',')})`)
            .bind(...categoryIds)
            .all<CategoryRow>()
        : Promise.resolve({ results: [] as CategoryRow[] }),
      categoryIds.length
        ? db
            .prepare(`SELECT * FROM category_prices WHERE category_id IN (${categoryIds.map(() => '?').join(',')})`)
            .bind(...categoryIds)
            .all<CategoryPriceRow>()
        : Promise.resolve({ results: [] as CategoryPriceRow[] }),
      itemIds.length
        ? db
            .prepare(`SELECT * FROM item_prices WHERE item_id IN (${itemIds.map(() => '?').join(',')})`)
            .bind(...itemIds)
            .all<ItemPriceRow>()
        : Promise.resolve({ results: [] as ItemPriceRow[] }),
      db.prepare('SELECT * FROM sizes ORDER BY display_order ASC').all<SizeRow>(),
      coverKeysByItem(db, itemIds),
    ]);

  const categoryById = new Map<number, Category>(categoryRowsResult.results.map((r) => [r.id, mapCategory(r)]));
  const categoryPrices: CategoryPrice[] = categoryPriceRowsResult.results.map(mapCategoryPrice);
  const itemPrices: ItemPrice[] = itemPriceRowsResult.results.map(mapItemPrice);
  const sizes: Size[] = sizeRowsResult.results.map(mapSize);

  const itemsByCollection = new Map<number, MenuItemWithPrices[]>();
  for (const row of itemRows) {
    const category = categoryById.get(row.category_id);
    if (!category) continue; // no debería pasar (FK a categories), pero no reventar si la data está inconsistente
    const item = mapMenuItem(row);
    const prices = category.hasSizes ? resolveItemPrices(item, category, sizes, categoryPrices, itemPrices) : [];
    const withPrices: MenuItemWithPrices = {
      ...item,
      price: category.hasSizes ? null : resolveSimplePrice(item),
      prices,
      coverImageKey: coverByItem.get(row.id) ?? null,
    };
    const list = itemsByCollection.get(row.collection_id) ?? [];
    itemsByCollection.set(row.collection_id, [...list, withPrices]);
  }

  return collectionRows.map((row) => ({
    ...mapCollection(row),
    items: itemsByCollection.get(row.id) ?? [],
  }));
}

/**
 * Público: colecciones activas con sus ítems activos ya resueltos (precios +
 * portada). Los ítems inactivos se omiten en silencio — nunca filtrar
 * borradores al público.
 */
collectionRoutes.get('/', async (c) => {
  const collections = await loadCollections(c.env.DB, {
    includeInactiveCollections: false,
    includeInactiveItems: false,
  });
  return c.json(collections);
});

/** Admin: todas las colecciones (incluidas inactivas) con todos sus ítems (incluidos inactivos) — el CMS necesita verlos para poder curarlos. */
collectionRoutes.get('/all', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const collections = await loadCollections(c.env.DB, {
    includeInactiveCollections: true,
    includeInactiveItems: true,
  });
  return c.json(collections);
});

/** Busca la colección por key, validando primero que sea una de las 3 fijas. */
async function requireCollectionByKey(db: D1Database, key: string): Promise<CollectionRow> {
  if (!isCollectionKey(key)) throw notFound('Colección no encontrada');
  const row = await db.prepare('SELECT * FROM collections WHERE key = ?').bind(key).first<CollectionRow>();
  if (!row) throw notFound('Colección no encontrada');
  return row;
}

/** Edita título/activo de una colección. La key es inmutable (no se puede crear ni borrar colecciones). */
collectionRoutes.patch('/:key', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const current = await requireCollectionByKey(c.env.DB, c.req.param('key'));
  const body = await parseBody(c, updateCollectionSchema);

  const updated = await c.env.DB.prepare(
    `UPDATE collections SET title_es = ?, title_en = ?, is_active = ? WHERE id = ? RETURNING *`,
  )
    .bind(
      body.titleEs ?? current.title_es,
      body.titleEn ?? current.title_en,
      body.isActive !== undefined ? (body.isActive ? 1 : 0) : current.is_active,
      current.id,
    )
    .first<CollectionRow>();

  const response: Collection = mapCollection(updated!);
  return c.json(response);
});

/**
 * Reemplaza el set completo de ítems de una colección (DELETE + INSERTs en
 * un solo DB.batch() atómico). Antes de escribir, valida que TODOS los
 * itemId existan en menu_items — si no, 400 listando los inexistentes en vez
 * de reventar a mitad del batch por violación de FK.
 */
collectionRoutes.put('/:key/items', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const collection = await requireCollectionByKey(c.env.DB, c.req.param('key'));
  const body = await parseBody(c, replaceCollectionItemsSchema);

  if (body.items.length > 0) {
    const itemIds = body.items.map((entry) => entry.itemId);
    const placeholders = itemIds.map(() => '?').join(',');
    const { results: existing } = await c.env.DB.prepare(`SELECT id FROM menu_items WHERE id IN (${placeholders})`)
      .bind(...itemIds)
      .all<{ id: number }>();
    const existingIds = new Set(existing.map((r) => r.id));
    const missing = [...new Set(itemIds.filter((id) => !existingIds.has(id)))];
    if (missing.length > 0) {
      throw badRequest(`itemId inválido: no existe(n) los ítems ${missing.join(', ')}`);
    }
  }

  // batch: DELETE + INSERTs atómicos (ver nota equivalente en categories.ts / menu-items.ts).
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM collection_items WHERE collection_id = ?').bind(collection.id),
    ...body.items.map((entry, index) =>
      c.env.DB.prepare('INSERT INTO collection_items (collection_id, item_id, display_order) VALUES (?, ?, ?)').bind(
        collection.id,
        entry.itemId,
        entry.displayOrder ?? index,
      ),
    ),
  ]);

  const [refreshed] = await loadCollections(c.env.DB, {
    collectionIds: [collection.id],
    includeInactiveCollections: true,
    includeInactiveItems: true,
  });
  return c.json(refreshed);
});
