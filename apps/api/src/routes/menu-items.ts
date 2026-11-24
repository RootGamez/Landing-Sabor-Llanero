import { Hono } from 'hono';
import { z } from 'zod';
import {
  assertOverrideKinds,
  createMenuItemSchema,
  resolveItemPrices,
  resolvePortionPrices,
  resolveSimplePrice,
  sizePriceInputSchema,
  updateMenuItemSchema,
  type Category,
  type CategoryPrice,
  type ItemPrice,
  type MenuItem,
  type MenuItemDetail,
  type MenuItemWithPrices,
  type PaginatedResult,
  type ResolvedPrice,
  type Size,
} from '@sabor/shared';
import { slugify } from '../lib/slug';
import type { AppEnv } from '../env';
import type {
  CategoryPriceRow,
  CategoryRow,
  ItemPriceRow,
  MediaRow,
  MenuItemRow,
  SizeRow,
} from '../db/rows';
import { mapCategory, mapCategoryPrice, mapItemPrice, mapMedia, mapMenuItem, mapSize } from '../db/rows';
import { coverKeysByItem } from '../db/covers';
import { authenticate, requireAuth, requireRole } from '../middleware/auth';
import { badRequest, conflict, notFound } from '../lib/http-error';
import { parseBody } from '../lib/validate';
import { parsePositiveInt, requireIdParam } from '../lib/params';
import { WEB_CHANNELS, channelCondition, requestedChannels } from '../lib/menu-channel';
import { allSizes } from './categories';

export const menuItemRoutes = new Hono<AppEnv>();

const PAGE_SIZE_DEFAULT = 24;

type MenuItemWithCover = MenuItem & { coverImageKey: string | null };

menuItemRoutes.get('/', async (c) => {
  const categoryId = c.req.query('categoryId');
  const search = c.req.query('search');
  const page = Math.max(1, parsePositiveInt(c.req.query('page'), 1));
  const pageSize = Math.min(100, Math.max(1, parsePositiveInt(c.req.query('pageSize'), PAGE_SIZE_DEFAULT)));

  const channel = channelCondition(await requestedChannels(c));
  const conditions = ['is_active = 1', channel.sql];
  const params: unknown[] = [...channel.params];
  if (categoryId !== undefined) {
    const parsedCategoryId = Number(categoryId);
    if (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0) {
      throw badRequest('categoryId inválido');
    }
    conditions.push('category_id = ?');
    params.push(parsedCategoryId);
  }
  if (search) {
    conditions.push('(name_es LIKE ? OR name_en LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  const where = conditions.join(' AND ');

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM menu_items WHERE ${where}`)
    .bind(...params)
    .first<{ total: number }>();

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM menu_items WHERE ${where} ORDER BY display_order ASC, created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, (page - 1) * pageSize)
    .all<MenuItemRow>();

  const coverByItem = await coverKeysByItem(c.env.DB, results.map((r) => r.id));

  const body: PaginatedResult<MenuItemWithCover> = {
    items: results.map((r) => ({ ...mapMenuItem(r), coverImageKey: coverByItem.get(r.id) ?? null })),
    page,
    pageSize,
    total: countRow?.total ?? 0,
  };
  return c.json(body);
});

/* Rutas estáticas ANTES de /:slug — Hono matchea en orden de registro y
 * /:slug se tragaría "sections" como si fuera un slug. */

const SECTION_ITEMS_DEFAULT = 8;
const SECTION_ITEMS_MAX = 24;
/** Mostrador (`channel=pos|all`, exige sesión): sin el tope público, el POS lista la carta completa. */
const SECTION_ITEMS_MAX_STAFF = 200;

interface MenuSectionResponse {
  category: Category;
  items: MenuItemWithPrices[];
}

/**
 * Catálogo por secciones (público): cada categoría activa con sus ítems
 * activos (top-N por display_order, window function, sin N+1) y los precios
 * YA resueltos (BLUEPRINT §4.2) — el público nunca calcula precios.
 */
menuItemRoutes.get('/sections', async (c) => {
  const channels = await requestedChannels(c);
  const maxItems = channels.includes('pos') ? SECTION_ITEMS_MAX_STAFF : SECTION_ITEMS_MAX;
  const limit = Math.min(maxItems, Math.max(1, parsePositiveInt(c.req.query('limit'), SECTION_ITEMS_DEFAULT)));
  const channel = channelCondition(channels, 'mi.channel');

  const [{ results: categories }, { results: items }, sizeRows] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY display_order ASC, name_es ASC').all<CategoryRow>(),
    c.env.DB.prepare(
      `SELECT * FROM (
         SELECT mi.*, ROW_NUMBER() OVER (
           PARTITION BY mi.category_id ORDER BY mi.display_order ASC, mi.id ASC
         ) AS rn
         FROM menu_items mi
         WHERE mi.is_active = 1 AND ${channel.sql}
       ) WHERE rn <= ?`,
    )
      .bind(...channel.params, limit)
      .all<MenuItemRow & { rn: number }>(),
    c.env.DB.prepare('SELECT * FROM sizes ORDER BY display_order ASC').all<SizeRow>(),
  ]);
  const sizes: Size[] = sizeRows.results.map(mapSize);

  const categoryIds = categories.map((r) => r.id);
  const itemIds = items.map((r) => r.id);
  const [categoryPriceRows, itemPriceRows, coverByItem] = await Promise.all([
    categoryIds.length
      ? c.env.DB.prepare(
          `SELECT * FROM category_prices WHERE category_id IN (${categoryIds.map(() => '?').join(',')})`,
        )
          .bind(...categoryIds)
          .all<CategoryPriceRow>()
      : Promise.resolve({ results: [] as CategoryPriceRow[] }),
    itemIds.length
      ? c.env.DB.prepare(`SELECT * FROM item_prices WHERE item_id IN (${itemIds.map(() => '?').join(',')})`)
          .bind(...itemIds)
          .all<ItemPriceRow>()
      : Promise.resolve({ results: [] as ItemPriceRow[] }),
    coverKeysByItem(c.env.DB, itemIds),
  ]);
  const categoryPrices: CategoryPrice[] = categoryPriceRows.results.map(mapCategoryPrice);
  const itemPrices: ItemPrice[] = itemPriceRows.results.map(mapItemPrice);

  const categoryById = new Map(categories.map((r) => [r.id, r]));
  const itemsByCategory = new Map<number, MenuItemWithPrices[]>();
  for (const row of items) {
    const categoryRow = categoryById.get(row.category_id);
    if (!categoryRow) continue;
    const category = mapCategory(categoryRow);
    const item = mapMenuItem(row);
    // Con tamaños: precio por tamaño; sin tamaños: presentaciones del ítem (vacío si no tiene).
    const prices = category.hasSizes
      ? resolveItemPrices(item, category, sizes, categoryPrices, itemPrices)
      : resolvePortionPrices(item, itemPrices, sizes);
    const list = itemsByCategory.get(row.category_id) ?? [];
    itemsByCategory.set(row.category_id, [
      ...list,
      {
        ...item,
        price: category.hasSizes ? null : resolveSimplePrice(item),
        prices,
        coverImageKey: coverByItem.get(row.id) ?? null,
      },
    ]);
  }

  const sections: MenuSectionResponse[] = categories
    .filter((row) => itemsByCategory.has(row.id))
    .map((row) => ({
      category: mapCategory(row),
      items: itemsByCategory.get(row.id)!,
    }));
  return c.json(sections);
});

menuItemRoutes.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  // El futuro CMS reusa esta misma ruta para cargar por id numérico (edición);
  // el público siempre entra por slug.
  const isNumericId = /^\d+$/.test(slug);

  let item: MenuItemRow | null;
  if (isNumericId) {
    // Acceso por id numérico = edición desde el CMS: exige auth y permite ver
    // ítems inactivos (borradores). Sin token, 401.
    await authenticate(c);
    item = await c.env.DB.prepare('SELECT * FROM menu_items WHERE id = ?')
      .bind(Number(slug))
      .first<MenuItemRow>();
  } else {
    // Acceso público por slug: solo ítems activos, para no filtrar borradores.
    const channel = channelCondition(WEB_CHANNELS);
    item = await c.env.DB.prepare(
      `SELECT * FROM menu_items WHERE slug = ? AND is_active = 1 AND ${channel.sql}`,
    )
      .bind(slug, ...channel.params)
      .first<MenuItemRow>();
  }
  if (!item) throw notFound('Ítem no encontrado');

  const [categoryRow, { results: mediaRows }, { results: sizeRows }] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(item.category_id).first<CategoryRow>(),
    c.env.DB.prepare('SELECT * FROM item_media WHERE item_id = ? ORDER BY display_order ASC')
      .bind(item.id)
      .all<MediaRow>(),
    c.env.DB.prepare('SELECT * FROM sizes ORDER BY display_order ASC').all<SizeRow>(),
  ]);
  if (!categoryRow) throw notFound('Categoría del ítem no encontrada');
  const category = mapCategory(categoryRow);
  const sizes: Size[] = sizeRows.map(mapSize);

  const [{ results: categoryPriceRows }, { results: itemPriceRows }] = await Promise.all([
    category.hasSizes
      ? c.env.DB.prepare('SELECT * FROM category_prices WHERE category_id = ?').bind(category.id).all<CategoryPriceRow>()
      : Promise.resolve({ results: [] as CategoryPriceRow[] }),
    c.env.DB.prepare('SELECT * FROM item_prices WHERE item_id = ?').bind(item.id).all<ItemPriceRow>(),
  ]);
  const itemPrices = itemPriceRows.map(mapItemPrice);
  const prices: ResolvedPrice[] = category.hasSizes
    ? resolveItemPrices(item, category, sizes, categoryPriceRows.map(mapCategoryPrice), itemPrices)
    : resolvePortionPrices(item, itemPrices, sizes);

  const detail: MenuItemDetail = {
    ...mapMenuItem(item),
    media: mediaRows.map(mapMedia),
    category: { id: category.id, slug: category.slug, nameEs: category.nameEs, nameEn: category.nameEn, hasSizes: category.hasSizes },
    prices,
  };
  return c.json(detail);
});

const priceOverridesInputSchema = z.object({
  priceOverrides: z.array(sizePriceInputSchema),
});

/** Categoría destino de un ítem, con validación de existencia. */
async function requireCategory(db: D1Database, categoryId: number): Promise<CategoryRow> {
  const row = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(categoryId).first<CategoryRow>();
  if (!row) throw badRequest('categoryId inválido: la categoría no existe');
  return row;
}

type PriceOverride = { sizeId: number; price: number };

/**
 * Los overrides de un ítem deben ser del tipo que admite su categoría: tamaños
 * de pizza (`kind = 'size'`) si vende por tamaño, presentaciones (`'portion'`)
 * si no (0012). Evita mezclar tipos y ids inexistentes (FK) antes de escribir.
 */
async function assertOverridesForCategory(
  db: D1Database,
  overrides: readonly PriceOverride[],
  categoryHasSizes: boolean,
): Promise<void> {
  if (overrides.length === 0) return;
  const { results } = await db.prepare('SELECT * FROM sizes').all<SizeRow>();
  const message = assertOverrideKinds(overrides, results.map(mapSize), categoryHasSizes);
  if (message) throw badRequest(message);
}

function insertOverrideStatements(db: D1Database, itemId: number, overrides: readonly PriceOverride[]): D1PreparedStatement[] {
  return overrides.map((entry) =>
    db.prepare('INSERT INTO item_prices (item_id, size_id, price) VALUES (?, ?, ?)').bind(itemId, entry.sizeId, entry.price),
  );
}

/** Reemplaza TODO el set de overrides del ítem (DELETE + INSERTs atómicos en un batch, ver categories.ts). */
async function replaceItemOverrides(db: D1Database, itemId: number, overrides: readonly PriceOverride[]): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM item_prices WHERE item_id = ?').bind(itemId),
    ...insertOverrideStatements(db, itemId, overrides),
  ]);
}

/** ¿La categoría destino cambia el modo de precio (con/sin tamaños) respecto de la actual del ítem? */
async function changedPriceMode(db: D1Database, previousCategoryId: number, next: CategoryRow): Promise<boolean> {
  if (previousCategoryId === next.id) return false;
  const previous = await db
    .prepare('SELECT has_sizes FROM categories WHERE id = ?')
    .bind(previousCategoryId)
    .first<Pick<CategoryRow, 'has_sizes'>>();
  return Boolean(previous?.has_sizes) !== Boolean(next.has_sizes);
}

menuItemRoutes.post('/', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const body = await parseBody(c, createMenuItemSchema);
  const category = await requireCategory(c.env.DB, body.categoryId);

  // Invariantes BLUEPRINT §4.2: categorías con tamaño no llevan price propio;
  // categorías sin tamaño exigen price (base / "1 docena") y sus priceOverrides,
  // si los hay, son presentaciones (0012).
  let price: number | null;
  if (category.has_sizes) {
    if (body.price != null) {
      throw badRequest('los ítems de categorías con tamaños no llevan price propio (usar priceOverrides)');
    }
    price = null;
  } else {
    if (body.price == null) {
      throw badRequest('las categorías sin tamaños requieren price');
    }
    price = body.price;
  }
  const overrides = body.priceOverrides ?? [];
  // Antes del INSERT: un override inválido no debe dejar el ítem creado a medias.
  await assertOverridesForCategory(c.env.DB, overrides, Boolean(category.has_sizes));

  const slug = body.slug?.trim() || slugify(body.nameEs);
  const existing = await c.env.DB.prepare('SELECT id FROM menu_items WHERE slug = ?').bind(slug).first();
  if (existing) throw conflict('Ya existe un ítem con ese slug');

  const result = await c.env.DB.prepare(
    `INSERT INTO menu_items
      (category_id, slug, name_es, name_en, description_es, description_en, price, channel, is_featured, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
  )
    .bind(
      body.categoryId,
      slug,
      body.nameEs,
      body.nameEn ?? '',
      body.descriptionEs ?? '',
      body.descriptionEn ?? '',
      price,
      body.channel ?? 'both',
      body.isFeatured ?? false ? 1 : 0,
      body.isActive ?? true ? 1 : 0,
    )
    .first<MenuItemRow>();
  const item = result!;

  if (overrides.length > 0) {
    // batch: todos los INSERT se comitean como una sola transacción atómica.
    await c.env.DB.batch(insertOverrideStatements(c.env.DB, item.id, overrides));
  }

  const withPromo = await applyPromoConfig(c.env.DB, item, body, Boolean(category.has_sizes));
  return c.json(mapMenuItem(withPromo), 201);
});

menuItemRoutes.patch('/:id', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = requireIdParam(c);
  const body = await parseBody(c, updateMenuItemSchema);

  const current = await c.env.DB.prepare('SELECT * FROM menu_items WHERE id = ?')
    .bind(id)
    .first<MenuItemRow>();
  if (!current) throw notFound('Ítem no encontrado');

  const categoryId = body.categoryId ?? current.category_id;
  const category = await requireCategory(c.env.DB, categoryId);

  let price: number | null;
  if (category.has_sizes) {
    if (body.price != null) {
      throw badRequest('los ítems de categorías con tamaños no llevan price propio (usar priceOverrides)');
    }
    price = null;
  } else {
    price = body.price !== undefined ? body.price : current.price;
    if (price == null) {
      throw badRequest('las categorías sin tamaños requieren price');
    }
  }
  if (body.priceOverrides !== undefined) {
    await assertOverridesForCategory(c.env.DB, body.priceOverrides, Boolean(category.has_sizes));
  }

  const updated = await c.env.DB.prepare(
    `UPDATE menu_items SET
      category_id = ?, slug = ?, name_es = ?, name_en = ?, description_es = ?, description_en = ?,
      price = ?, channel = ?, is_featured = ?, is_active = ?, display_order = ?, updated_at = datetime('now')
     WHERE id = ? RETURNING *`,
  )
    .bind(
      categoryId,
      body.slug ?? current.slug,
      body.nameEs ?? current.name_es,
      body.nameEn ?? current.name_en,
      body.descriptionEs ?? current.description_es,
      body.descriptionEn ?? current.description_en,
      price,
      body.channel ?? current.channel,
      body.isFeatured !== undefined ? (body.isFeatured ? 1 : 0) : current.is_featured,
      body.isActive !== undefined ? (body.isActive ? 1 : 0) : current.is_active,
      body.displayOrder ?? current.display_order,
      id,
    )
    .first<MenuItemRow>();

  if (body.priceOverrides !== undefined) {
    await replaceItemOverrides(c.env.DB, id, body.priceOverrides);
  } else if (await changedPriceMode(c.env.DB, current.category_id, category)) {
    // Pasar de una categoría con tamaños a una sin ellos (o al revés) invalida
    // los overrides previos (tamaños vs presentaciones): se limpian.
    await c.env.DB.prepare('DELETE FROM item_prices WHERE item_id = ?').bind(id).run();
  }

  const withPromo = await applyPromoConfig(c.env.DB, updated!, body, Boolean(category.has_sizes));
  return c.json(mapMenuItem(withPromo));
});

interface PromoConfigInput {
  promoPizzaCount?: number | null;
  promoPizzaSizeId?: number | null;
}

/**
 * Configura "promo con pizzas a elegir" (0011). Solo toca las columnas si el
 * body las trae (o si hay que limpiarlas al pasar a una categoría con tamaños),
 * así el resto del CRUD funciona igual con una base aún sin migrar.
 */
async function applyPromoConfig(
  db: D1Database,
  row: MenuItemRow,
  body: PromoConfigInput,
  categoryHasSizes: boolean,
): Promise<MenuItemRow> {
  const requested = body.promoPizzaCount !== undefined || body.promoPizzaSizeId !== undefined;
  const hasCurrent = (row.promo_pizza_count ?? null) !== null;
  if (!requested && !(categoryHasSizes && hasCurrent)) return row;

  let count = body.promoPizzaCount ?? null;
  let sizeId = body.promoPizzaSizeId ?? null;
  if (categoryHasSizes) {
    if (count !== null) throw badRequest('solo los ítems de categorías sin tamaños (promos) incluyen pizzas a elegir');
    count = null;
    sizeId = null;
  } else if (sizeId !== null && !(await allSizes(db)).some((size) => size.id === sizeId)) {
    throw badRequest('promoPizzaSizeId no es un tamaño válido');
  }
  const saved = await db
    .prepare('UPDATE menu_items SET promo_pizza_count = ?, promo_pizza_size_id = ? WHERE id = ? RETURNING *')
    .bind(count, sizeId, row.id)
    .first<MenuItemRow>();
  return saved ?? row;
}

/**
 * Reemplaza el set completo de overrides de precio de un ítem (BLUEPRINT §4.2):
 * por tamaño si su categoría vende por tamaño, por presentación (0012) si no.
 * Vacío = vuelve a heredar de category_prices (tamaños) o a venderse solo con
 * su `price` único (presentaciones).
 */
menuItemRoutes.put('/:id/prices', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = requireIdParam(c);
  const body = await parseBody(c, priceOverridesInputSchema);

  const current = await c.env.DB.prepare('SELECT * FROM menu_items WHERE id = ?')
    .bind(id)
    .first<MenuItemRow>();
  if (!current) throw notFound('Ítem no encontrado');

  const category = await requireCategory(c.env.DB, current.category_id);
  await assertOverridesForCategory(c.env.DB, body.priceOverrides, Boolean(category.has_sizes));
  await replaceItemOverrides(c.env.DB, id, body.priceOverrides);

  const { results } = await c.env.DB.prepare('SELECT * FROM item_prices WHERE item_id = ?')
    .bind(id)
    .all<ItemPriceRow>();
  return c.json(results.map(mapItemPrice));
});

menuItemRoutes.delete('/:id', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = requireIdParam(c);

  // Recolectar las claves R2 ANTES de borrar el ítem, para poder limpiar el
  // bucket (las filas de item_media caen por CASCADE, los objetos R2 no).
  const { results: media } = await c.env.DB.prepare('SELECT r2_key FROM item_media WHERE item_id = ?')
    .bind(id)
    .all<{ r2_key: string }>();

  const result = await c.env.DB.prepare('DELETE FROM menu_items WHERE id = ?').bind(id).run();
  if (result.meta.changes === 0) throw notFound('Ítem no encontrado');

  // Borrado explícito de los objetos R2 huérfanos para no acumular almacenamiento facturable.
  await Promise.all(media.map((m) => c.env.MEDIA.delete(m.r2_key)));

  return c.body(null, 204);
});
