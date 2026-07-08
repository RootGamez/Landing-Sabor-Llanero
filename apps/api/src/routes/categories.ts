import { Hono } from 'hono';
import { z } from 'zod';
import {
  ALLOWED_MEDIA_MIME,
  CATEGORY_MEDIA_KEY_PREFIX,
  MEDIA_MAX_UPLOAD_BYTES,
  MEDIA_MAX_UPLOAD_MB,
  createCategorySchema,
  sizePriceInputSchema,
  updateCategorySchema,
  type Category,
  type CategoryPrice,
} from '@sabor/shared';
import type { AppEnv } from '../env';
import type { CategoryPriceRow, CategoryRow, SizeRow } from '../db/rows';
import { mapCategory, mapCategoryPrice } from '../db/rows';
import { authenticate, requireAuth, requireRole } from '../middleware/auth';
import { badRequest, conflict, notFound } from '../lib/http-error';
import { parseBody } from '../lib/validate';
import { requireIdParam } from '../lib/params';

/** Convención de claves R2 para banners: categories/{category_id}/{uuid}.{ext}. */
function buildBannerKey(categoryId: number, ext: string): string {
  return `${CATEGORY_MEDIA_KEY_PREFIX}${categoryId}/${crypto.randomUUID()}.${ext}`;
}

export const categoryRoutes = new Hono<AppEnv>();

type CategoryWithPrices = Category & { prices: CategoryPrice[] };

/** Carga todos los category_prices de una lista de categorías en una sola query (anti N+1). */
async function pricesByCategory(
  db: D1Database,
  categoryIds: number[],
): Promise<Map<number, CategoryPrice[]>> {
  const byCategory = new Map<number, CategoryPrice[]>();
  if (categoryIds.length === 0) return byCategory;
  const placeholders = categoryIds.map(() => '?').join(',');
  const { results } = await db
    .prepare(`SELECT * FROM category_prices WHERE category_id IN (${placeholders})`)
    .bind(...categoryIds)
    .all<CategoryPriceRow>();
  for (const row of results) {
    const price = mapCategoryPrice(row);
    const list = byCategory.get(price.categoryId) ?? [];
    byCategory.set(price.categoryId, [...list, price]);
  }
  return byCategory;
}

// Con sesión válida (owner/admin, los únicos roles que existen) se listan
// todas las categorías, incluidas inactivas, para el futuro CMS; sin sesión
// (público) solo las activas — mismo criterio que /menu-items para no
// filtrar borradores.
categoryRoutes.get('/', async (c) => {
  let isAuthenticated = false;
  try {
    await authenticate(c);
    isAuthenticated = true;
  } catch {
    isAuthenticated = false;
  }

  const { results } = await c.env.DB.prepare(
    isAuthenticated
      ? 'SELECT * FROM categories ORDER BY display_order ASC, name_es ASC'
      : 'SELECT * FROM categories WHERE is_active = 1 ORDER BY display_order ASC, name_es ASC',
  ).all<CategoryRow>();
  const priceMap = await pricesByCategory(c.env.DB, results.map((r) => r.id));

  const body: CategoryWithPrices[] = results.map((row) => ({
    ...mapCategory(row),
    prices: priceMap.get(row.id) ?? [],
  }));
  return c.json(body);
});

/** Todos los tamaños del negocio, usados para validar cobertura de precios. */
export async function allSizes(db: D1Database): Promise<SizeRow[]> {
  const { results } = await db.prepare('SELECT * FROM sizes ORDER BY display_order ASC').all<SizeRow>();
  return results;
}

/**
 * Rechaza cualquier sizeId que no corresponda a un tamaño real. Sin esto, un
 * sizeId inexistente (ej. 999) pasa la validación de Zod (que no tiene acceso
 * a la DB) y revienta a mitad del batch por violación de FK. Se exporta para
 * reusarla en menu-items.ts, donde los priceOverrides deben ser subconjunto
 * de los tamaños existentes (no necesitan cobertura completa).
 */
export function assertKnownSizeIds(prices: Array<{ sizeId: number }>, sizes: SizeRow[]): void {
  const validIds = new Set(sizes.map((s) => s.id));
  const unknown = [...new Set(prices.map((p) => p.sizeId).filter((id) => !validIds.has(id)))];
  if (unknown.length > 0) {
    throw badRequest(`sizeId inválido: no existe(n) los tamaños ${unknown.join(', ')}`);
  }
}

/**
 * Regla del BLUEPRINT §4.2: una categoría con tamaños debe traer precio para
 * TODOS los tamaños del negocio (el Zod de shared solo valida "sin duplicados,
 * no vacío" porque no tiene acceso a la DB; acá se verifica la cobertura real).
 */
function assertFullSizeCoverage(prices: Array<{ sizeId: number }>, sizes: SizeRow[]): void {
  assertKnownSizeIds(prices, sizes);
  const provided = new Set(prices.map((p) => p.sizeId));
  const missing = sizes.filter((s) => !provided.has(s.id));
  if (missing.length > 0) {
    throw badRequest(
      `faltan precios para los tamaños: ${missing.map((s) => s.label_es).join(', ')}`,
    );
  }
}

categoryRoutes.post('/', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const body = await parseBody(c, createCategorySchema);

  const existing = await c.env.DB.prepare('SELECT id FROM categories WHERE slug = ?')
    .bind(body.slug)
    .first();
  if (existing) throw conflict('Ya existe una categoría con ese slug');

  if (body.hasSizes) {
    assertFullSizeCoverage(body.prices ?? [], await allSizes(c.env.DB));
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO categories (slug, name_es, name_en, has_sizes, display_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING *`,
  )
    .bind(
      body.slug,
      body.nameEs,
      body.nameEn ?? '',
      body.hasSizes ? 1 : 0,
      body.displayOrder ?? 0,
      body.isActive ?? true ? 1 : 0,
    )
    .first<CategoryRow>();
  const category = result!;

  if (body.hasSizes && body.prices && body.prices.length > 0) {
    // batch: todos los INSERT se comitean como una sola transacción atómica.
    await c.env.DB.batch(
      body.prices.map((entry) =>
        c.env.DB.prepare(
          'INSERT INTO category_prices (category_id, size_id, price) VALUES (?, ?, ?)',
        ).bind(category.id, entry.sizeId, entry.price),
      ),
    );
  }

  const priceMap = await pricesByCategory(c.env.DB, [category.id]);
  const responseBody: CategoryWithPrices = {
    ...mapCategory(category),
    prices: priceMap.get(category.id) ?? [],
  };
  return c.json(responseBody, 201);
});

categoryRoutes.patch('/:id', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = requireIdParam(c);
  const body = await parseBody(c, updateCategorySchema);

  const current = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ?')
    .bind(id)
    .first<CategoryRow>();
  if (!current) throw notFound('Categoría no encontrada');

  const hasSizes = body.hasSizes ?? Boolean(current.has_sizes);

  // Cambiar el modo de precio de una categoría con ítems ya cargados dejaría
  // esos ítems en un estado inconsistente (price/priceOverrides ya no
  // corresponden al nuevo modo). Se exige vaciar la categoría antes.
  if (hasSizes !== Boolean(current.has_sizes)) {
    const itemCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM menu_items WHERE category_id = ?',
    )
      .bind(id)
      .first<{ count: number }>();
    if ((itemCount?.count ?? 0) > 0) {
      throw conflict('No se puede cambiar el modo de precio de una categoría con ítems; movelos o borralos primero');
    }
  }

  if (hasSizes && body.prices) {
    assertFullSizeCoverage(body.prices, await allSizes(c.env.DB));
  }

  const updated = await c.env.DB.prepare(
    `UPDATE categories SET
      slug = ?, name_es = ?, name_en = ?, has_sizes = ?, display_order = ?, is_active = ?
     WHERE id = ? RETURNING *`,
  )
    .bind(
      body.slug ?? current.slug,
      body.nameEs ?? current.name_es,
      body.nameEn ?? current.name_en,
      hasSizes ? 1 : 0,
      body.displayOrder ?? current.display_order,
      body.isActive !== undefined ? (body.isActive ? 1 : 0) : current.is_active,
      id,
    )
    .first<CategoryRow>();

  if (!hasSizes) {
    await c.env.DB.prepare('DELETE FROM category_prices WHERE category_id = ?').bind(id).run();
  } else if (body.prices) {
    // batch: DELETE + INSERTs en una sola transacción atómica (D1 batch), para
    // que un fallo a mitad de camino no deje la cobertura de precios rota.
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM category_prices WHERE category_id = ?').bind(id),
      ...body.prices.map((entry) =>
        c.env.DB.prepare(
          'INSERT INTO category_prices (category_id, size_id, price) VALUES (?, ?, ?)',
        ).bind(id, entry.sizeId, entry.price),
      ),
    ]);
  }

  const priceMap = await pricesByCategory(c.env.DB, [id]);
  const responseBody: CategoryWithPrices = {
    ...mapCategory(updated!),
    prices: priceMap.get(id) ?? [],
  };
  return c.json(responseBody);
});

categoryRoutes.delete('/:id', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = requireIdParam(c);
  const current = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ?')
    .bind(id)
    .first<CategoryRow>();
  if (!current) throw notFound('Categoría no encontrada');

  // D1 primero, R2 después (mismo criterio que media.ts): si el borrado del
  // objeto falla, queda un huérfano facturable pero inofensivo. La FK de
  // menu_items es ON DELETE RESTRICT: si tiene ítems, D1 rechaza el borrado
  // (el onError central lo traduce a 400).
  await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  if (current.banner_image_key) await c.env.MEDIA.delete(current.banner_image_key);
  return c.body(null, 204);
});

/**
 * Reemplaza el set completo de precios por tamaño de una categoría (BLUEPRINT
 * §4.2). Solo tiene sentido si `hasSizes = true`; exige precio para todos los
 * tamaños del negocio.
 */
const categoryPricesInputSchema = z.object({
  prices: z.array(sizePriceInputSchema),
});

categoryRoutes.put('/:id/prices', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = requireIdParam(c);
  const body = await parseBody(c, categoryPricesInputSchema);

  const current = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ?')
    .bind(id)
    .first<CategoryRow>();
  if (!current) throw notFound('Categoría no encontrada');
  if (!current.has_sizes) {
    throw badRequest('esta categoría no vende por tamaño (hasSizes = false)');
  }

  assertFullSizeCoverage(body.prices, await allSizes(c.env.DB));

  // batch: DELETE + INSERTs atómicos (ver nota en PATCH /:id más arriba).
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM category_prices WHERE category_id = ?').bind(id),
    ...body.prices.map((entry) =>
      c.env.DB.prepare(
        'INSERT INTO category_prices (category_id, size_id, price) VALUES (?, ?, ?)',
      ).bind(id, entry.sizeId, entry.price),
    ),
  ]);

  const priceMap = await pricesByCategory(c.env.DB, [id]);
  return c.json(priceMap.get(id) ?? []);
});

/**
 * Sube (o reemplaza) el banner de una categoría. Multipart con campo "file";
 * solo imágenes (los banners no admiten video). Espejo del flujo de subida de
 * media de ítems (routes/media.ts).
 */
categoryRoutes.post('/:id/banner', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = requireIdParam(c);
  const current = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ?')
    .bind(id)
    .first<CategoryRow>();
  if (!current) throw notFound('Categoría no encontrada');

  const formData = await c.req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) throw badRequest('Se requiere un archivo en el campo "file"');

  const rule = ALLOWED_MEDIA_MIME[file.type];
  if (!rule || rule.type !== 'image') {
    throw badRequest('Tipo de archivo no permitido (usar JPG, PNG, WebP o GIF)');
  }
  if (file.size > MEDIA_MAX_UPLOAD_BYTES) {
    throw badRequest(`El archivo supera el máximo de ${MEDIA_MAX_UPLOAD_MB} MB`);
  }

  const key = buildBannerKey(id, rule.ext);
  await c.env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const updated = await c.env.DB.prepare(
    'UPDATE categories SET banner_image_key = ? WHERE id = ? RETURNING *',
  )
    .bind(key, id)
    .first<CategoryRow>();

  // El banner anterior se borra al final: si falla, D1 ya apunta al nuevo.
  if (current.banner_image_key) await c.env.MEDIA.delete(current.banner_image_key);
  return c.json(mapCategory(updated!));
});

/** Quita el banner de una categoría (columna a NULL + borrado del objeto R2). */
categoryRoutes.delete('/:id/banner', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = requireIdParam(c);
  const current = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ?')
    .bind(id)
    .first<CategoryRow>();
  if (!current) throw notFound('Categoría no encontrada');

  const updated = await c.env.DB.prepare(
    'UPDATE categories SET banner_image_key = NULL WHERE id = ? RETURNING *',
  )
    .bind(id)
    .first<CategoryRow>();
  if (current.banner_image_key) await c.env.MEDIA.delete(current.banner_image_key);
  return c.json(mapCategory(updated!));
});
