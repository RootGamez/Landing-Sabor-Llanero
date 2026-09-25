import { Hono } from 'hono';
import {
  ALLOWED_MEDIA_MIME,
  MEDIA_MAX_UPLOAD_BYTES,
  MEDIA_MAX_UPLOAD_MB,
  REWARD_MEDIA_KEY_PREFIX,
  createRewardSchema,
  updateRewardSchema,
  type RedeemRewardResponse,
} from '@sabor/shared';
import type { AppEnv } from '../env';
import type { CustomerRow, RewardRedemptionRow, RewardRow } from '../db/rows';
import { mapReward, mapRewardRedemption } from '../db/rows';
import { authenticate, requireAuth, requireRole } from '../middleware/auth';
import { requireCustomerAuth } from '../middleware/customer-auth';
import { badRequest, conflict, notFound } from '../lib/http-error';
import { parseBody } from '../lib/validate';
import { requireIdParam } from '../lib/params';

export const rewardsRoutes = new Hono<AppEnv>();

/** Convención de claves R2: rewards/{reward_id}/{uuid}.{ext} (mismo criterio que categories.ts). */
function buildRewardImageKey(rewardId: number, ext: string): string {
  return `${REWARD_MEDIA_KEY_PREFIX}${rewardId}/${crypto.randomUUID()}.${ext}`;
}

async function requireReward(db: D1Database, id: number): Promise<RewardRow> {
  const row = await db.prepare('SELECT * FROM rewards WHERE id = ?').bind(id).first<RewardRow>();
  if (!row) throw notFound('Premio no encontrado');
  return row;
}

// Con sesión (owner/admin) se listan todos los premios, incluidos inactivos,
// para el CMS; sin sesión (cliente/público) solo los activos — mismo criterio
// que /categories y /menu-items para no filtrar borradores.
rewardsRoutes.get('/', async (c) => {
  let isAuthenticated = false;
  try {
    await authenticate(c);
    isAuthenticated = true;
  } catch {
    isAuthenticated = false;
  }

  const { results } = await c.env.DB.prepare(
    isAuthenticated
      ? 'SELECT * FROM rewards ORDER BY display_order ASC, id ASC'
      : 'SELECT * FROM rewards WHERE is_active = 1 ORDER BY display_order ASC, id ASC',
  ).all<RewardRow>();
  return c.json(results.map(mapReward));
});

rewardsRoutes.post('/', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const body = await parseBody(c, createRewardSchema);

  const result = await c.env.DB.prepare(
    `INSERT INTO rewards (name_es, name_en, description_es, description_en, points_cost, is_active, display_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
  )
    .bind(
      body.nameEs,
      body.nameEn ?? '',
      body.descriptionEs ?? '',
      body.descriptionEn ?? '',
      body.pointsCost,
      body.isActive ?? true ? 1 : 0,
      body.displayOrder ?? 0,
    )
    .first<RewardRow>();
  return c.json(mapReward(result!), 201);
});

rewardsRoutes.patch('/:id', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = requireIdParam(c);
  const body = await parseBody(c, updateRewardSchema);
  const current = await requireReward(c.env.DB, id);

  const updated = await c.env.DB.prepare(
    `UPDATE rewards SET
      name_es = ?, name_en = ?, description_es = ?, description_en = ?,
      points_cost = ?, is_active = ?, display_order = ?
     WHERE id = ? RETURNING *`,
  )
    .bind(
      body.nameEs ?? current.name_es,
      body.nameEn ?? current.name_en,
      body.descriptionEs ?? current.description_es,
      body.descriptionEn ?? current.description_en,
      body.pointsCost ?? current.points_cost,
      body.isActive !== undefined ? (body.isActive ? 1 : 0) : current.is_active,
      body.displayOrder ?? current.display_order,
      id,
    )
    .first<RewardRow>();
  return c.json(mapReward(updated!));
});

rewardsRoutes.delete('/:id', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = requireIdParam(c);
  const current = await requireReward(c.env.DB, id);

  // reward_redemptions.reward_id es ON DELETE RESTRICT: si tiene canjes, D1
  // rechaza el borrado (el onError central lo traduce a 400) — mismo criterio
  // que menu_items dentro de una categoría con ítems.
  await c.env.DB.prepare('DELETE FROM rewards WHERE id = ?').bind(id).run();
  if (current.image_r2_key) await c.env.MEDIA.delete(current.image_r2_key);
  return c.body(null, 204);
});

/** Sube (o reemplaza) la imagen de un premio. Espejo de POST /categories/:id/banner. */
rewardsRoutes.post('/:id/image', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = requireIdParam(c);
  const current = await requireReward(c.env.DB, id);

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

  const key = buildRewardImageKey(id, rule.ext);
  await c.env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

  const updated = await c.env.DB.prepare('UPDATE rewards SET image_r2_key = ? WHERE id = ? RETURNING *')
    .bind(key, id)
    .first<RewardRow>();

  // La imagen anterior se borra al final: si falla, D1 ya apunta a la nueva.
  if (current.image_r2_key) await c.env.MEDIA.delete(current.image_r2_key);
  return c.json(mapReward(updated!));
});

rewardsRoutes.delete('/:id/image', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = requireIdParam(c);
  const current = await requireReward(c.env.DB, id);

  const updated = await c.env.DB.prepare('UPDATE rewards SET image_r2_key = NULL WHERE id = ? RETURNING *')
    .bind(id)
    .first<RewardRow>();
  if (current.image_r2_key) await c.env.MEDIA.delete(current.image_r2_key);
  return c.json(mapReward(updated!));
});

/**
 * Canje (cliente logueado). El guard atómico vive DENTRO del UPDATE (WHERE
 * points_balance >= ?), no como un SELECT previo: mismo idiom que el resto
 * del repo para evitar TOCTOU — dos canjes concurrentes con saldo justo para
 * uno solo no pueden dejar el balance negativo (bloqueado además por el
 * CHECK (points_balance >= 0) de la tabla como backstop).
 */
rewardsRoutes.post('/:id/redeem', requireCustomerAuth, async (c) => {
  const rewardId = requireIdParam(c);
  const authCustomer = c.get('customer');

  const reward = await requireReward(c.env.DB, rewardId);
  if (!reward.is_active) throw badRequest('Este premio ya no está disponible');

  const customer = await c.env.DB.prepare(
    'UPDATE customers SET points_balance = points_balance - ? WHERE id = ? AND points_balance >= ? RETURNING *',
  )
    .bind(reward.points_cost, authCustomer.id, reward.points_cost)
    .first<CustomerRow>();
  if (!customer) throw conflict('Saldo de puntos insuficiente para este premio');

  let redemptionRow: RewardRedemptionRow;
  try {
    const batchResults = await c.env.DB.batch<RewardRedemptionRow>([
      c.env.DB.prepare(
        'INSERT INTO reward_redemptions (customer_id, reward_id, points_spent) VALUES (?, ?, ?) RETURNING *',
      ).bind(authCustomer.id, reward.id, reward.points_cost),
      c.env.DB.prepare(
        "INSERT INTO points_ledger (customer_id, order_id, delta, reason) VALUES (?, NULL, ?, 'reward_redeemed')",
      ).bind(authCustomer.id, -reward.points_cost),
    ]);
    redemptionRow = batchResults[0]!.results[0]!;
  } catch (err) {
    // El débito de arriba no puede vivir en este mismo batch: el guard de
    // saldo insuficiente necesita su propio UPDATE con WHERE (no puede
    // combinarse con estos INSERT incondicionales sin arriesgar crear un
    // canje "gratis" si el guard no afectó ninguna fila). Si el registro de
    // auditoría de este batch falla igual, se compensa devolviendo los
    // puntos ya debitados — así no queda una pérdida de puntos sin rastro.
    await c.env.DB.prepare('UPDATE customers SET points_balance = points_balance + ? WHERE id = ?')
      .bind(reward.points_cost, authCustomer.id)
      .run();
    throw err;
  }

  const dto: RedeemRewardResponse = {
    redemption: mapRewardRedemption(redemptionRow),
    pointsBalance: customer.points_balance,
  };
  return c.json(dto, 201);
});
