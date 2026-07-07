import { Hono } from 'hono';
import { z } from 'zod';
import {
  createMenuItemSchema,
  resolveItemPrices,
  resolveSimplePrice,
  sizePriceInputSchema,
  updateMenuItemSchema,
  type Category,
  type CategoryPrice,
  type ItemPrice,
  type MenuItem,
  type MenuItemDetail,
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
import { mapCategoryPrice, mapItemPrice, mapMedia, mapMenuItem, mapSize } from '../db/rows';
import { coverKeysByItem } from '../db/covers';
import { authenticate, requireAuth, requireRole } from '../middleware/auth';
import { badRequest, conflict, notFound } from '../lib/http-error';
import { parseBody } from '../lib/validate';

export const menuItemRoutes = new Hono<AppEnv>();

const PAGE_SIZE_DEFAULT = 24;

type MenuItemWithCover = MenuItem & { coverImageKey: string | null };

menuItemRoutes.get('/', async (c) => {
  const categoryId = c.req.query('categoryId');
  const search = c.req.query('search');
  const page = Math.max(1, Number(c.req.query('page') ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query('pageSize') ?? PAGE_SIZE_DEFAULT)));

  const conditions = ['is_active = 1'];
  const params: unknown[] = [];
  if (categoryId) {
    conditions.push('category_id = ?');
    params.push(Number(categoryId));
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

interface SectionItem extends MenuItem {
  prices: ResolvedPrice[];
  coverImageKey: string | null;
}
interface MenuSectionResponse {
  category: Category;
  items: SectionItem[];
}

/**
 * Catálogo por secciones (público): cada categoría activa con sus ítems
 * activos (top-N por display_order, window function, sin N+1) y los precios
 * YA resueltos (BLUEPRINT §4.2) — el público nunca calcula precios.
 */
menuItemRoutes.get('/sections', async (c) => {
  const limit = Math.min(
    SECTION_ITEMS_MAX,
    Math.max(1, Number(c.req.query('limit') ?? SECTION_ITEMS_DEFAULT)),
  );

  const [{ results: categories }, { results: items }, sizeRows] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY display_order ASC, name_es ASC').all<CategoryRow>(),
    c.env.DB.prepare(
      `SELECT * FROM (
         SELECT mi.*, ROW_NUMBER() OVER (
           PARTITION BY mi.category_id ORDER BY mi.display_order ASC, mi.id ASC
         ) AS rn
         FROM menu_items mi
         WHERE mi.is_active = 1
       ) WHERE rn <= ?`,
    )
      .bind(limit)
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
  const itemsByCategory = new Map<number, SectionItem[]>();
  for (const row of items) {
    const categoryRow = categoryById.get(row.category_id);
    if (!categoryRow) continue;
    const category = mapCategoryFromRow(categoryRow);
    const item = mapMenuItem(row);
    const prices = category.hasSizes
      ? resolveItemPrices(item, category, sizes, categoryPrices, itemPrices)
      : [];
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
      category: mapCategoryFromRow(row),
      items: itemsByCategory.get(row.id)!,
    }));
  return c.json(sections);
});

// mapCategory vive en db/rows.ts pero se referencia acá con otro nombre para
// evitar un import cruzado confuso entre "row de categoría" y "fila db".
function mapCategoryFromRow(r: CategoryRow): Category {
  return {
    id: r.id,
    slug: r.slug,
    nameEs: r.name_es,
    nameEn: r.name_en,
    hasSizes: Boolean(r.has_sizes),
    displayOrder: r.display_order,
    bannerImageKey: r.banner_image_key,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at,
  };
}

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
    item = await c.env.DB.prepare('SELECT * FROM menu_items WHERE slug = ? AND is_active = 1')
      .bind(slug)
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
  const category = mapCategoryFromRow(categoryRow);
  const sizes: Size[] = sizeRows.map(mapSize);

  let prices: ResolvedPrice[] = [];
  if (category.hasSizes) {
    const [{ results: categoryPriceRows }, { results: itemPriceRows }] = await Promise.all([
      c.env.DB.prepare('SELECT * FROM category_prices WHERE category_id = ?')
        .bind(category.id)
        .all<CategoryPriceRow>(),
      c.env.DB.prepare('SELECT * FROM item_prices WHERE item_id = ?').bind(item.id).all<ItemPriceRow>(),
    ]);
    prices = resolveItemPrices(
      item,
      category,
      sizes,
      categoryPriceRows.map(mapCategoryPrice),
      itemPriceRows.map(mapItemPrice),
    );
  }

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

menuItemRoutes.post('/', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const body = await parseBody(c, createMenuItemSchema);
  const category = await requireCategory(c.env.DB, body.categoryId);

  // Invariantes BLUEPRINT §4.2: categorías con tamaño no llevan price propio;
  // categorías sin tamaño exigen price y no admiten overrides.
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
    if (body.priceOverrides && body.priceOverrides.length > 0) {
      throw badRequest('los ítems de categorías sin tamaños no admiten priceOverrides');
    }
    price = body.price;
  }

  const slug = body.slug?.trim() || slugify(body.nameEs);
  const existing = await c.env.DB.prepare('SELECT id FROM menu_items WHERE slug = ?').bind(slug).first();
  if (existing) throw conflict('Ya existe un ítem con ese slug');

  const result = await c.env.DB.prepare(
    `INSERT INTO menu_items
      (category_id, slug, name_es, name_en, description_es, description_en, price, is_featured, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      body.isFeatured ?? false ? 1 : 0,
      body.isActive ?? true ? 1 : 0,
    )
    .first<MenuItemRow>();
  const item = result!;

  if (category.has_sizes && body.priceOverrides) {
    for (const entry of body.priceOverrides) {
      await c.env.DB.prepare('INSERT INTO item_prices (item_id, size_id, price) VALUES (?, ?, ?)')
        .bind(item.id, entry.sizeId, entry.price)
        .run();
    }
  }

  return c.json(mapMenuItem(item), 201);
});

menuItemRoutes.patch('/:id', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));
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
    if (body.priceOverrides && body.priceOverrides.length > 0) {
      throw badRequest('los ítems de categorías sin tamaños no admiten priceOverrides');
    }
  }

  const updated = await c.env.DB.prepare(
    `UPDATE menu_items SET
      category_id = ?, slug = ?, name_es = ?, name_en = ?, description_es = ?, description_en = ?,
      price = ?, is_featured = ?, is_active = ?, display_order = ?, updated_at = datetime('now')
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
      body.isFeatured !== undefined ? (body.isFeatured ? 1 : 0) : current.is_featured,
      body.isActive !== undefined ? (body.isActive ? 1 : 0) : current.is_active,
      body.displayOrder ?? current.display_order,
      id,
    )
    .first<MenuItemRow>();

  // Cambiar de categoría a una sin tamaños, o simplemente ya no tenerlos,
  // invalida cualquier override previo — se limpia siempre que corresponda.
  if (!category.has_sizes) {
    await c.env.DB.prepare('DELETE FROM item_prices WHERE item_id = ?').bind(id).run();
  } else if (body.priceOverrides !== undefined) {
    await c.env.DB.prepare('DELETE FROM item_prices WHERE item_id = ?').bind(id).run();
    for (const entry of body.priceOverrides) {
      await c.env.DB.prepare('INSERT INTO item_prices (item_id, size_id, price) VALUES (?, ?, ?)')
        .bind(id, entry.sizeId, entry.price)
        .run();
    }
  }

  return c.json(mapMenuItem(updated!));
});

/**
 * Reemplaza el set completo de overrides de precio por tamaño de un ítem
 * (BLUEPRINT §4.2). Vacío = el ítem vuelve a heredar todo de category_prices.
 * Solo válido si la categoría del ítem vende por tamaño.
 */
menuItemRoutes.put('/:id/prices', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const body = await parseBody(c, priceOverridesInputSchema);

  const current = await c.env.DB.prepare('SELECT * FROM menu_items WHERE id = ?')
    .bind(id)
    .first<MenuItemRow>();
  if (!current) throw notFound('Ítem no encontrado');

  const category = await requireCategory(c.env.DB, current.category_id);
  if (!category.has_sizes) {
    throw badRequest('la categoría de este ítem no vende por tamaño (hasSizes = false)');
  }

  await c.env.DB.prepare('DELETE FROM item_prices WHERE item_id = ?').bind(id).run();
  for (const entry of body.priceOverrides) {
    await c.env.DB.prepare('INSERT INTO item_prices (item_id, size_id, price) VALUES (?, ?, ?)')
      .bind(id, entry.sizeId, entry.price)
      .run();
  }

  const { results } = await c.env.DB.prepare('SELECT * FROM item_prices WHERE item_id = ?')
    .bind(id)
    .all<ItemPriceRow>();
  return c.json(results.map(mapItemPrice));
});

menuItemRoutes.delete('/:id', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));

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
