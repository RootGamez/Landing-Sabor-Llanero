import { Hono } from 'hono';
import {
  ALLOWED_MEDIA_MIME,
  MEDIA_MAX_UPLOAD_BYTES,
  MEDIA_MAX_UPLOAD_MB,
  REWARD_MEDIA_KEY_PREFIX,
  createRewardSchema,
  updateRewardSchema,
  type OrderDto,
  type RedeemRewardResponse,
} from '@sabor/shared';
import type { AppEnv } from '../env';
import type { CustomerRow, OrderItemRow, OrderRow, RewardRedemptionRow, RewardRow } from '../db/rows';
import { mapOrder, mapOrderItem, mapReward, mapRewardRedemption } from '../db/rows';
import { authenticate, requireAuth, requireRole } from '../middleware/auth';
import { requireCustomerAuth } from '../middleware/customer-auth';
import { badRequest, conflict, notFound } from '../lib/http-error';
import { parseBody } from '../lib/validate';
import { requireIdParam } from '../lib/params';
import { generateOrderCode } from '../lib/order-code';

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
    `INSERT INTO rewards (name_es, name_en, description_es, description_en, points_cost, price, discount_price, is_active, display_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`,
  )
    .bind(
      body.nameEs,
      body.nameEn ?? '',
      body.descriptionEs ?? '',
      body.descriptionEn ?? '',
      body.pointsCost,
      body.price,
      body.discountPrice ?? null,
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

  // discountPrice < price ya se valida en updateRewardSchema cuando AMBOS
  // llegan en el body — acá se revalida contra el price ACTUAL de la fila
  // para el caso de un PATCH que solo manda discountPrice (Zod no tiene
  // acceso a la DB para esa combinación, ver validation.ts).
  const nextPrice = body.price ?? current.price;
  const nextDiscountPrice = body.discountPrice !== undefined ? body.discountPrice : current.discount_price;
  if (nextDiscountPrice != null && (nextPrice == null || nextDiscountPrice >= nextPrice)) {
    throw badRequest('discountPrice debe ser menor a price');
  }

  const updated = await c.env.DB.prepare(
    `UPDATE rewards SET
      name_es = ?, name_en = ?, description_es = ?, description_en = ?,
      points_cost = ?, price = ?, discount_price = ?, is_active = ?, display_order = ?
     WHERE id = ? RETURNING *`,
  )
    .bind(
      body.nameEs ?? current.name_es,
      body.nameEn ?? current.name_en,
      body.descriptionEs ?? current.description_es,
      body.descriptionEn ?? current.description_en,
      body.pointsCost ?? current.points_cost,
      nextPrice,
      nextDiscountPrice,
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
 *
 * El canje genera un pedido REAL (orders/order_items, source =
 * 'reward_redemption') en vez de vivir aislado en reward_redemptions: así el
 * local lo acepta/rechaza desde el mismo tablero de Pedidos que ya usa para
 * todo lo demás (routes/orders.ts PATCH /:id). unitPrice = discountPrice ??
 * price del premio (siempre > 0, ya que reward.price se exige no-nulo acá
 * abajo) — el pedido documenta el valor del premio entregado; el pago real ya
 * ocurrió en puntos, arriba.
 */
rewardsRoutes.post('/:id/redeem', requireCustomerAuth, async (c) => {
  const rewardId = requireIdParam(c);
  const authCustomer = c.get('customer');

  const reward = await requireReward(c.env.DB, rewardId);
  if (!reward.is_active) throw badRequest('Este premio ya no está disponible');
  if (reward.price == null) throw badRequest('Este premio todavía no tiene un precio configurado');

  const customer = await c.env.DB.prepare(
    'UPDATE customers SET points_balance = points_balance - ? WHERE id = ? AND points_balance >= ? RETURNING *',
  )
    .bind(reward.points_cost, authCustomer.id, reward.points_cost)
    .first<CustomerRow>();
  if (!customer) throw conflict('Saldo de puntos insuficiente para este premio');

  const code = generateOrderCode();
  const unitPrice = reward.discount_price ?? reward.price;

  let orderRow: OrderRow;
  let orderItemRow: OrderItemRow;
  let redemptionRow: RewardRedemptionRow;
  try {
    const batchResults = await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO orders (customer_id, code, subtotal, source) VALUES (?, ?, ?, 'reward_redemption') RETURNING *",
      ).bind(authCustomer.id, code, unitPrice),
      c.env.DB.prepare(
        `INSERT INTO order_items (order_id, reward_id, name_es, name_en, unit_price, quantity)
         SELECT id, ?, ?, ?, ?, 1 FROM orders WHERE code = ?
         RETURNING *`,
      ).bind(reward.id, reward.name_es, reward.name_en, unitPrice, code),
      c.env.DB.prepare(
        `INSERT INTO reward_redemptions (customer_id, reward_id, points_spent, order_id)
         SELECT ?, ?, ?, id FROM orders WHERE code = ?
         RETURNING *`,
      ).bind(authCustomer.id, reward.id, reward.points_cost, code),
      c.env.DB.prepare(
        `INSERT INTO points_ledger (customer_id, order_id, delta, reason)
         SELECT ?, id, ?, 'reward_redeemed' FROM orders WHERE code = ?`,
      ).bind(authCustomer.id, -reward.points_cost, code),
    ]);
    // .batch() no puede tipar 3 RETURNING distintos bajo un solo genérico —
    // se castea cada resultado explícitamente (mismo criterio que los `!` ya
    // usados acá abajo para el DTO).
    orderRow = batchResults[0]!.results[0] as OrderRow;
    orderItemRow = batchResults[1]!.results[0] as OrderItemRow;
    redemptionRow = batchResults[2]!.results[0] as RewardRedemptionRow;
  } catch (err) {
    // El débito de arriba no puede vivir en este mismo batch: el guard de
    // saldo insuficiente necesita su propio UPDATE con WHERE (no puede
    // combinarse con estos INSERT incondicionales sin arriesgar crear un
    // canje "gratis" si el guard no afectó ninguna fila). Si el batch falla
    // igual, se compensa devolviendo los puntos ya debitados — así no queda
    // una pérdida de puntos sin rastro.
    try {
      await c.env.DB.prepare('UPDATE customers SET points_balance = points_balance + ? WHERE id = ?')
        .bind(reward.points_cost, authCustomer.id)
        .run();
    } catch (compensationErr) {
      // Si ESTO también falla, el cliente queda debitado sin ningún rastro en
      // points_ledger (el INSERT vivía dentro del batch que ya falló) — este
      // log es la única señal para una corrección manual (manual_adjustment).
      console.error(
        `Falló la compensación de puntos tras un canje fallido: customerId=${authCustomer.id} rewardId=${reward.id} points=${reward.points_cost}`,
        compensationErr,
      );
    }
    throw err;
  }

  const orderDto: OrderDto = { ...mapOrder(orderRow), items: [mapOrderItem(orderItemRow)] };
  const dto: RedeemRewardResponse = {
    redemption: mapRewardRedemption(redemptionRow),
    order: orderDto,
    pointsBalance: customer.points_balance,
  };
  return c.json(dto, 201);
});
