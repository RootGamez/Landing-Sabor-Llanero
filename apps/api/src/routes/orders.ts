import { Hono } from 'hono';
import {
  createOrderSchema,
  orderStatusUpdateSchema,
  resolveItemPrices,
  resolveSimplePrice,
  type OrderDto,
  type OrderItem,
  type OrderItemInput,
  type OrderStatus,
  type PaginatedResult,
} from '@sabor/shared';
import type { AppEnv } from '../env';
import type {
  CategoryPriceRow,
  CategoryRow,
  ItemPriceRow,
  LoyaltyConfigRow,
  MenuItemRow,
  OrderItemRow,
  OrderRow,
  RewardRedemptionRow,
  SizeRow,
} from '../db/rows';
import {
  mapCategory,
  mapCategoryPrice,
  mapItemPrice,
  mapMenuItem,
  mapOrder,
  mapOrderItem,
  mapSize,
} from '../db/rows';
import { generateOrderCode } from '../lib/order-code';
import { currentPeriod } from '../lib/period';
import { badRequest, conflict, notFound } from '../lib/http-error';
import { parseBody } from '../lib/validate';
import { parsePositiveInt, requireIdParam } from '../lib/params';
import { requireAuth, requireRole } from '../middleware/auth';
import { requireCustomerAuth } from '../middleware/customer-auth';

export const ordersRoutes = new Hono<AppEnv>();

const PAGE_SIZE_DEFAULT = 24;
const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'cancelled'];

interface OrderLine {
  itemId: number;
  nameEs: string;
  nameEn: string;
  sizeLabel: string | null;
  unitPrice: number;
  quantity: number;
}

interface PricingContext {
  itemById: Map<number, MenuItemRow>;
  categoryById: Map<number, CategoryRow>;
  categoryPriceRows: CategoryPriceRow[];
  itemPriceRows: ItemPriceRow[];
  sizeById: Map<number, SizeRow>;
}

/** Carga en bulk (sin N+1) todo lo que hace falta para tasar un carrito. */
async function loadPricingContext(db: D1Database, inputs: OrderItemInput[]): Promise<PricingContext> {
  const itemIds = [...new Set(inputs.map((i) => i.itemId))];
  const { results: itemRows } = await db
    .prepare(`SELECT * FROM menu_items WHERE id IN (${itemIds.map(() => '?').join(',')}) AND is_active = 1`)
    .bind(...itemIds)
    .all<MenuItemRow>();

  const categoryIds = [...new Set(itemRows.map((r) => r.category_id))];
  const [categoryRowsResult, categoryPriceRowsResult, itemPriceRowsResult, sizeRowsResult] = await Promise.all([
    categoryIds.length
      ? db.prepare(`SELECT * FROM categories WHERE id IN (${categoryIds.map(() => '?').join(',')})`).bind(...categoryIds).all<CategoryRow>()
      : Promise.resolve({ results: [] as CategoryRow[] }),
    categoryIds.length
      ? db.prepare(`SELECT * FROM category_prices WHERE category_id IN (${categoryIds.map(() => '?').join(',')})`).bind(...categoryIds).all<CategoryPriceRow>()
      : Promise.resolve({ results: [] as CategoryPriceRow[] }),
    itemIds.length
      ? db.prepare(`SELECT * FROM item_prices WHERE item_id IN (${itemIds.map(() => '?').join(',')})`).bind(...itemIds).all<ItemPriceRow>()
      : Promise.resolve({ results: [] as ItemPriceRow[] }),
    db.prepare('SELECT * FROM sizes').all<SizeRow>(),
  ]);

  return {
    itemById: new Map(itemRows.map((r) => [r.id, r])),
    categoryById: new Map(categoryRowsResult.results.map((r) => [r.id, r])),
    categoryPriceRows: categoryPriceRowsResult.results,
    itemPriceRows: itemPriceRowsResult.results,
    sizeById: new Map(sizeRowsResult.results.map((r) => [r.id, r])),
  };
}

/**
 * Tasa una línea del carrito con `resolveItemPrices`/`resolveSimplePrice`
 * (packages/shared/pricing.ts, puras, sin reimplementar la lógica acá). El
 * precio que manda el cliente en el body NO se lee acá — solo itemId/sizeId/quantity.
 */
function buildOrderLine(input: OrderItemInput, ctx: PricingContext): OrderLine {
  const itemRow = ctx.itemById.get(input.itemId);
  if (!itemRow) throw badRequest(`itemId ${input.itemId} no existe o no está activo`);
  const categoryRow = ctx.categoryById.get(itemRow.category_id);
  if (!categoryRow) throw notFound('Categoría del ítem no encontrada');
  const category = mapCategory(categoryRow);
  const item = mapMenuItem(itemRow);

  let unitPrice: number;
  let sizeLabel: string | null;
  if (category.hasSizes) {
    if (input.sizeId === undefined) throw badRequest(`itemId ${input.itemId} requiere sizeId`);
    const sizeRow = ctx.sizeById.get(input.sizeId);
    if (!sizeRow) throw badRequest(`sizeId ${input.sizeId} inválido`);
    const size = mapSize(sizeRow);
    const categoryPrices = ctx.categoryPriceRows
      .filter((p) => p.category_id === itemRow.category_id)
      .map(mapCategoryPrice);
    const itemPrices = ctx.itemPriceRows.filter((p) => p.item_id === input.itemId).map(mapItemPrice);
    const [resolved] = resolveItemPrices(item, category, [size], categoryPrices, itemPrices);
    if (!resolved) throw badRequest(`no hay precio configurado para itemId ${input.itemId} en ese tamaño`);
    unitPrice = resolved.price;
    sizeLabel = size.labelEs;
  } else {
    if (input.sizeId !== undefined) throw badRequest(`itemId ${input.itemId} no vende por tamaño`);
    unitPrice = resolveSimplePrice(item);
    sizeLabel = null;
  }

  return {
    itemId: input.itemId,
    nameEs: itemRow.name_es,
    nameEn: itemRow.name_en,
    sizeLabel,
    unitPrice,
    quantity: input.quantity,
  };
}

async function resolveOrderLines(
  db: D1Database,
  inputs: OrderItemInput[],
): Promise<{ lines: OrderLine[]; subtotal: number }> {
  const ctx = await loadPricingContext(db, inputs);
  const lines = inputs.map((input) => buildOrderLine(input, ctx));
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  return { lines, subtotal: Math.round(subtotal * 100) / 100 };
}

/** Anti-N+1: todos los `order_items` de varios pedidos en una sola query, agrupados por order_id. */
async function orderItemsByOrder(db: D1Database, orderIds: number[]): Promise<Map<number, OrderItem[]>> {
  const map = new Map<number, OrderItem[]>();
  if (orderIds.length === 0) return map;
  const { results } = await db
    .prepare(`SELECT * FROM order_items WHERE order_id IN (${orderIds.map(() => '?').join(',')}) ORDER BY id ASC`)
    .bind(...orderIds)
    .all<OrderItemRow>();
  for (const row of results) {
    const item = mapOrderItem(row);
    map.set(item.orderId, [...(map.get(item.orderId) ?? []), item]);
  }
  return map;
}

async function currentOrderStatus(db: D1Database, id: number): Promise<OrderStatus | undefined> {
  const row = await db.prepare('SELECT status FROM orders WHERE id = ?').bind(id).first<{ status: OrderStatus }>();
  return row?.status;
}

/**
 * Acredita puntos + entrada al sorteo del mes por un pedido recién
 * confirmado. Todo en un solo `.batch()` (transacción real de D1): balance
 * del cliente, historial auditable, entrada al sorteo y el propio
 * `orders.points_awarded`. Se llama SOLO después de que el UPDATE atómico de
 * `orders` (WHERE status = 'pending') ya afectó una fila — por eso no puede
 * ejecutarse dos veces para el mismo pedido (ver comentario del handler).
 *
 * Se llama SOLO para pedidos `source = 'storefront'` (ver el handler PATCH
 * más abajo): un pedido generado por un canje de premio ya se pagó en puntos,
 * así que acreditar puntos/sorteo también sobre su subtotal sería un
 * double-dip (el cliente ganaría puntos por gastar puntos).
 */
async function awardLoyaltyForOrder(db: D1Database, order: OrderRow): Promise<void> {
  const config = await db
    .prepare('SELECT * FROM loyalty_config ORDER BY id LIMIT 1')
    .first<Pick<LoyaltyConfigRow, 'points_per_currency_unit' | 'min_order_amount_for_points'>>();
  if (!config) {
    // No debería pasar (seed.sql siembra la fila única), pero si el seed no
    // corrió, confirmar el pedido no tiene por qué bloquearse — se acreditan
    // 0 puntos en vez de reventar, dejando rastro en los logs del Worker.
    console.error('loyalty_config sin sembrar: se confirma el pedido con 0 puntos otorgados');
  }
  const pointsPerUnit = config?.points_per_currency_unit ?? 0;
  const minOrderAmount = config?.min_order_amount_for_points ?? 0;
  // Redondeo a 6 decimales antes de Math.floor: subtotal/pointsPerUnit son
  // floats y su producto puede caer justo debajo de un entero (ej. la clase
  // de error de 1.005 * 100), lo que restaría 1 punto por redondeo binario.
  const rawPoints = order.subtotal >= minOrderAmount ? order.subtotal * pointsPerUnit : 0;
  const pointsAwarded = Math.floor(Math.round(rawPoints * 1e6) / 1e6);
  const period = currentPeriod();

  await db.batch([
    db.prepare('UPDATE customers SET points_balance = points_balance + ? WHERE id = ?').bind(
      pointsAwarded,
      order.customer_id,
    ),
    db.prepare(
      "INSERT INTO points_ledger (customer_id, order_id, delta, reason) VALUES (?, ?, ?, 'order_confirmed')",
    ).bind(order.customer_id, order.id, pointsAwarded),
    db.prepare('INSERT INTO raffle_entries (customer_id, order_id, period) VALUES (?, ?, ?)').bind(
      order.customer_id,
      order.id,
      period,
    ),
    db.prepare('UPDATE orders SET points_awarded = ? WHERE id = ?').bind(pointsAwarded, order.id),
  ]);
}

/**
 * Reembolsa los puntos gastados cuando se cancela un pedido-canje (decisión
 * de producto: cancelar = el cliente no recibió el premio, así que recupera
 * los puntos). Simétrica a `awardLoyaltyForOrder` pero en la dirección
 * contraria. Se llama SOLO tras el UPDATE atómico de `orders` (WHERE status =
 * 'pending') que cancela el pedido — mismo candado que arriba, no puede
 * ejecutarse dos veces para el mismo pedido.
 */
async function refundRewardRedemption(db: D1Database, order: OrderRow): Promise<void> {
  const redemption = await db
    .prepare('SELECT * FROM reward_redemptions WHERE order_id = ?')
    .bind(order.id)
    .first<RewardRedemptionRow>();
  if (!redemption) {
    // No debería pasar (todo pedido source='reward_redemption' se crea junto
    // con su reward_redemptions en el mismo batch, ver routes/rewards.ts) —
    // pero si ocurriera, cancelar el pedido no tiene por qué bloquearse.
    console.error(`orders.id=${order.id} source=reward_redemption sin reward_redemptions asociada`);
    return;
  }
  await db.batch([
    db.prepare('UPDATE customers SET points_balance = points_balance + ? WHERE id = ?').bind(
      redemption.points_spent,
      redemption.customer_id,
    ),
    db.prepare(
      "INSERT INTO points_ledger (customer_id, order_id, delta, reason) VALUES (?, ?, ?, 'reward_redemption_refunded')",
    ).bind(redemption.customer_id, order.id, redemption.points_spent),
    db.prepare("UPDATE reward_redemptions SET status = 'cancelled' WHERE id = ?").bind(redemption.id),
  ]);
}

/**
 * Alta de pedido (cliente logueado). subtotal SIEMPRE recalculado arriba —
 * nada del body del cliente sobre precio llega a la DB. El INSERT de `orders`
 * y los de `order_items` van en un solo `.batch()` (una sola transacción real
 * de D1): los ítems se insertan con `SELECT id ... FROM orders WHERE code = ?`
 * en vez de encadenar el id devuelto por el INSERT anterior (D1 no soporta
 * eso entre statements de un mismo batch) — así no puede quedar un pedido
 * "fantasma" sin ítems si el batch fallara a mitad de camino.
 */
ordersRoutes.post('/', requireCustomerAuth, async (c) => {
  const authCustomer = c.get('customer');
  const body = await parseBody(c, createOrderSchema);

  const { lines, subtotal } = await resolveOrderLines(c.env.DB, body.items);
  const code = generateOrderCode();

  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO orders (customer_id, code, subtotal) VALUES (?, ?, ?)').bind(
      authCustomer.id,
      code,
      subtotal,
    ),
    ...lines.map((line) =>
      c.env.DB.prepare(
        `INSERT INTO order_items (order_id, item_id, name_es, name_en, size_label, unit_price, quantity)
         SELECT id, ?, ?, ?, ?, ?, ? FROM orders WHERE code = ?`,
      ).bind(line.itemId, line.nameEs, line.nameEn, line.sizeLabel, line.unitPrice, line.quantity, code),
    ),
  ]);

  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE code = ?').bind(code).first<OrderRow>();
  const { results: itemRows } = await c.env.DB.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC')
    .bind(order!.id)
    .all<OrderItemRow>();

  const dto: OrderDto = { ...mapOrder(order!), items: itemRows.map(mapOrderItem) };
  return c.json(dto, 201);
});

// Listado para el CMS (admin/owner), paginado y filtrable por status.
ordersRoutes.get('/', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const status = c.req.query('status');
  if (status !== undefined && !ORDER_STATUSES.includes(status as OrderStatus)) {
    throw badRequest(`status inválido: debe ser uno de ${ORDER_STATUSES.join(', ')}`);
  }
  const page = Math.max(1, parsePositiveInt(c.req.query('page'), 1));
  const pageSize = Math.min(100, Math.max(1, parsePositiveInt(c.req.query('pageSize'), PAGE_SIZE_DEFAULT)));

  const where = status ? 'WHERE status = ?' : '';
  const params = status ? [status] : [];

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM orders ${where}`)
    .bind(...params)
    .first<{ total: number }>();
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, (page - 1) * pageSize)
    .all<OrderRow>();

  const itemsByOrder = await orderItemsByOrder(c.env.DB, results.map((r) => r.id));

  const body: PaginatedResult<OrderDto> = {
    items: results.map((r) => ({ ...mapOrder(r), items: itemsByOrder.get(r.id) ?? [] })),
    page,
    pageSize,
    total: countRow?.total ?? 0,
  };
  return c.json(body);
});

// Historial propio del cliente logueado (volumen bajo por cliente, sin paginar).
ordersRoutes.get('/me', requireCustomerAuth, async (c) => {
  const authCustomer = c.get('customer');
  const { results } = await c.env.DB.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC')
    .bind(authCustomer.id)
    .all<OrderRow>();

  const itemsByOrder = await orderItemsByOrder(c.env.DB, results.map((r) => r.id));
  const body: OrderDto[] = results.map((r) => ({ ...mapOrder(r), items: itemsByOrder.get(r.id) ?? [] }));
  return c.json(body);
});

/**
 * Confirmar/cancelar (admin/owner). La transición vive DENTRO del UPDATE
 * (WHERE status = 'pending'), no como un SELECT previo: mismo idiom atómico
 * que el guard de "último owner" en routes/users.ts — dos PATCH concurrentes
 * sobre el mismo pedido no pueden acreditar puntos dos veces, porque solo uno
 * de los dos UPDATE puede afectar una fila (el segundo ve status ya
 * cambiado y no entra al bloque de acreditación). El índice único parcial
 * `idx_ledger_order_once` y el UNIQUE(order_id) de raffle_entries son el
 * backstop a nivel DB de este mismo invariante.
 */
ordersRoutes.patch('/:id', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = requireIdParam(c);
  const body = await parseBody(c, orderStatusUpdateSchema);
  const actingUser = c.get('user');

  if (body.status === 'cancelled') {
    const updated = await c.env.DB.prepare(
      `UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'pending' RETURNING *`,
    )
      .bind(id)
      .first<OrderRow>();
    if (!updated) {
      const status = await currentOrderStatus(c.env.DB, id);
      if (!status) throw notFound('Pedido no encontrado');
      throw conflict(`El pedido ya está en estado '${status}'`);
    }
    if (updated.source === 'reward_redemption') {
      try {
        await refundRewardRedemption(c.env.DB, updated);
      } catch (err) {
        // El pedido ya quedó 'cancelled' (UPDATE aparte, arriba, ya
        // confirmado). Un reintento del mismo PATCH no vuelve a entrar acá
        // (guard WHERE status = 'pending' ya no matchea) — si el reembolso
        // falla, este log es la única señal para detectarlo y corregirlo a
        // mano (manual_adjustment en points_ledger). La cancelación en sí ya
        // es real y no debe reportarse como error al staff que la pidió.
        console.error(`Falló el reembolso de puntos del pedido-canje cancelado: orderId=${updated.id}`, err);
      }
    }
    return c.json(mapOrder(updated));
  }

  const confirmed = await c.env.DB.prepare(
    `UPDATE orders SET status = 'confirmed', confirmed_at = datetime('now'), confirmed_by = ?
     WHERE id = ? AND status = 'pending' RETURNING *`,
  )
    .bind(actingUser.id, id)
    .first<OrderRow>();
  if (!confirmed) {
    const status = await currentOrderStatus(c.env.DB, id);
    if (!status) throw notFound('Pedido no encontrado');
    throw conflict(`El pedido ya está en estado '${status}'`);
  }

  if (confirmed.source === 'storefront') {
    await awardLoyaltyForOrder(c.env.DB, confirmed);
  } else {
    // Confirmar un pedido-canje = entregar el premio: la redención pasa a
    // 'fulfilled' en el mismo momento. Sin acreditar puntos/sorteo (ver
    // comentario de awardLoyaltyForOrder) — ese es justo el guard de arriba.
    await c.env.DB.prepare(
      `UPDATE reward_redemptions SET status = 'fulfilled', fulfilled_at = datetime('now'), fulfilled_by = ?
       WHERE order_id = ? AND status = 'pending'`,
    )
      .bind(actingUser.id, confirmed.id)
      .run();
  }

  const finalRow = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRow>();
  return c.json(mapOrder(finalRow!));
});
