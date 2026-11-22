import { Hono, type Context } from 'hono';
import {
  createSaleSchema,
  isValidLocalDate,
  localDayRangeUtc,
  toCents,
  voidSaleSchema,
  type CreateSaleInput,
  type PaginatedResult,
  type PendingWebOrder,
  type Sale,
} from '@sabor/shared';
import type { AppEnv } from '../env';
import { mapOrder, type OrderRow, type SaleRow } from '../db/rows';
import { badRequest, conflict, forbidden, notFound } from '../lib/http-error';
import { parseBody } from '../lib/validate';
import { parsePagination, requireIdParam } from '../lib/params';
import { insertSale } from '../lib/sale-create';
import { linesFromOrder, priceCartLines, sumLines, type SaleLine } from '../lib/sale-pricing';
import { findOpenSession, findSaleRow, findSaleRowByUuid, hydrateSales } from '../lib/sale-queries';
import { CASH_METHOD_KEY } from '../lib/session-summary';
import { orderItemsByOrder } from './orders';
import { requireAuth, requireRole } from '../middleware/auth';

/** Ventas del POS: owner/admin/cashier operan; el alcance del cajero se limita a la caja abierta. */
export const saleRoutes = new Hono<AppEnv>();
saleRoutes.use('*', requireAuth, requireRole('owner', 'admin', 'cashier'));

/** Ventana de "Cobrar pedido web": evita que pedidos confirmados antes del POS inunden la lista. */
const PENDING_WEB_ORDERS_DAYS = 7;
const PENDING_WEB_ORDERS_LIMIT = 100;

async function assertPaymentMethodActive(db: D1Database, key: string): Promise<void> {
  const row = await db
    .prepare('SELECT key FROM payment_methods WHERE key = ? AND is_active = 1')
    .bind(key)
    .first();
  if (!row) throw badRequest('Método de pago inválido o inactivo');
}

/** Solo el efectivo lleva "recibido" (≥ total) para calcular el vuelto; no se acepta en otros métodos. */
function resolveCashReceived(body: CreateSaleInput, totalCents: number): number | null {
  if (body.cashReceivedCents === undefined) return null;
  if (body.paymentMethod !== CASH_METHOD_KEY) {
    throw badRequest('cashReceivedCents solo aplica al pagar en efectivo');
  }
  if (body.cashReceivedCents < totalCents) {
    throw badRequest('El efectivo recibido no alcanza para cubrir el total');
  }
  return body.cashReceivedCents;
}

async function linesForSale(db: D1Database, body: CreateSaleInput): Promise<SaleLine[]> {
  if (body.orderId !== undefined) return linesFromOrder(db, body.orderId);
  return priceCartLines(db, body.items ?? []);
}

async function respondWithSale(c: Context<AppEnv>, row: SaleRow, status: 200 | 201): Promise<Response> {
  const [sale] = await hydrateSales(c.env.DB, [row]);
  return c.json(sale as Sale, status);
}

saleRoutes.post('/', async (c) => {
  const body = await parseBody(c, createSaleSchema);
  const user = c.get('user');
  const db = c.env.DB;

  // Idempotencia (D13): el reintento de un POST ya guardado devuelve la misma venta.
  const existing = await findSaleRowByUuid(db, body.clientUuid);
  if (existing) {
    if (user.role === 'cashier' && existing.created_by !== user.id) throw forbidden();
    return respondWithSale(c, existing, 200);
  }

  const session = await findOpenSession(db);
  if (!session) throw conflict('Abre la caja antes de registrar ventas');
  await assertPaymentMethodActive(db, body.paymentMethod);

  const lines = await linesForSale(db, body);
  const subtotalCents = sumLines(lines);
  if (body.discountCents > subtotalCents) throw badRequest('El descuento no puede superar el subtotal');
  const cashReceivedCents = resolveCashReceived(body, subtotalCents - body.discountCents);

  const result = await insertSale(db, {
    sessionId: session.id,
    createdBy: user.id,
    paymentMethod: body.paymentMethod,
    discountCents: body.discountCents,
    cashReceivedCents,
    orderId: body.orderId ?? null,
    clientUuid: body.clientUuid,
    lines,
  });
  if (result === 'session_closed') throw conflict('La caja se cerró, abre una nueva para vender');

  const saved = await findSaleRowByUuid(db, body.clientUuid);
  return respondWithSale(c, saved as SaleRow, result === 'created' ? 201 : 200);
});

saleRoutes.get('/pending-web-orders', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT o.*, cu.name AS customer_name, cu.phone AS customer_phone
       FROM orders o LEFT JOIN customers cu ON cu.id = o.customer_id
      WHERE o.status = 'confirmed' AND o.source = 'storefront'
        AND o.confirmed_at >= datetime('now', ?)
        AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_id = o.id)
      ORDER BY o.confirmed_at ASC, o.id ASC LIMIT ?`,
  )
    .bind(`-${PENDING_WEB_ORDERS_DAYS} days`, PENDING_WEB_ORDERS_LIMIT)
    .all<OrderRow>();
  const itemsByOrder = await orderItemsByOrder(c.env.DB, results.map((r) => r.id));
  const body: PendingWebOrder[] = results.map((row) => {
    const items = itemsByOrder.get(row.id) ?? [];
    const totalCents = items.reduce((sum, item) => sum + toCents(item.unitPrice) * item.quantity, 0);
    return { ...mapOrder(row), items, totalCents };
  });
  return c.json(body);
});

interface SaleFilters {
  where: string;
  params: Array<string | number>;
}

function dateFilter(value: string | undefined, name: 'from' | 'to'): string | undefined {
  if (value === undefined) return undefined;
  if (!isValidLocalDate(value)) throw badRequest(`${name} inválido (formato esperado: YYYY-MM-DD)`);
  return value;
}

/** Filtros del listado. El cajero queda fijado a la caja abierta (no ve historial ni otros días). */
async function buildSaleFilters(c: Context<AppEnv>): Promise<SaleFilters | null> {
  const sessionParam = c.req.query('session_id');
  const from = dateFilter(c.req.query('from'), 'from');
  const to = dateFilter(c.req.query('to'), 'to');
  if (from && to && from > to) throw badRequest('from no puede ser posterior a to');
  const sessionId = sessionParam === undefined ? undefined : Number(sessionParam);
  if (sessionId !== undefined && (!Number.isInteger(sessionId) || sessionId <= 0)) {
    throw badRequest('session_id inválido');
  }

  let effectiveSession = sessionId;
  if (c.get('user').role === 'cashier') {
    if (from || to) throw forbidden('El cajero solo ve las ventas de la caja abierta');
    const open = await findOpenSession(c.env.DB);
    if (sessionId !== undefined && sessionId !== open?.id) {
      throw forbidden('El cajero solo ve las ventas de la caja abierta');
    }
    if (!open) return null;
    effectiveSession = open.id;
  }

  const conditions: string[] = [];
  const params: Array<string | number> = [];
  if (effectiveSession !== undefined) {
    conditions.push('s.session_id = ?');
    params.push(effectiveSession);
  }
  if (from) {
    conditions.push('s.created_at >= ?');
    params.push(localDayRangeUtc(from).fromUtc);
  }
  if (to) {
    conditions.push('s.created_at < ?');
    params.push(localDayRangeUtc(to).toUtc);
  }
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

saleRoutes.get('/', async (c) => {
  const { page, pageSize } = parsePagination(c);
  const filters = await buildSaleFilters(c);
  if (!filters) return c.json({ items: [], page, pageSize, total: 0 } satisfies PaginatedResult<Sale>);

  const [count, { results }] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS total FROM sales s ${filters.where}`)
      .bind(...filters.params)
      .first<{ total: number }>(),
    c.env.DB.prepare(
      `SELECT s.* FROM sales s ${filters.where} ORDER BY s.created_at DESC, s.id DESC LIMIT ? OFFSET ?`,
    )
      .bind(...filters.params, pageSize, (page - 1) * pageSize)
      .all<SaleRow>(),
  ]);
  const body: PaginatedResult<Sale> = {
    items: await hydrateSales(c.env.DB, results),
    page,
    pageSize,
    total: count?.total ?? 0,
  };
  return c.json(body);
});

/** `true` si la venta pertenece a la caja abierta (único alcance del cajero). */
async function isInOpenSession(db: D1Database, row: SaleRow): Promise<boolean> {
  const open = await findOpenSession(db);
  return open?.id === row.session_id;
}

saleRoutes.get('/:id', async (c) => {
  const row = await findSaleRow(c.env.DB, requireIdParam(c));
  if (!row) throw notFound('Venta no encontrada');
  if (c.get('user').role === 'cashier' && !(await isInOpenSession(c.env.DB, row))) throw forbidden();
  return respondWithSale(c, row, 200);
});

/**
 * Anular (D4): con motivo, nunca borra. Owner siempre; admin/cajero solo
 * mientras la caja de esa venta siga abierta (la regla vive en el UPDATE: sin
 * ventana de carrera con el cierre). Libera `order_id` para poder volver a
 * cobrar el pedido web con otro método.
 */
saleRoutes.post('/:id/void', async (c) => {
  const id = requireIdParam(c);
  const body = await parseBody(c, voidSaleSchema);
  const user = c.get('user');

  const voided = await c.env.DB.prepare(
    `UPDATE sales SET voided_at = datetime('now'), voided_by = ?1, void_reason = ?2, order_id = NULL
      WHERE id = ?3 AND voided_at IS NULL
        AND (?4 = 1 OR EXISTS (SELECT 1 FROM cash_sessions cs WHERE cs.id = sales.session_id AND cs.closed_at IS NULL))
    RETURNING *`,
  )
    .bind(user.id, body.reason, id, user.role === 'owner' ? 1 : 0)
    .first<SaleRow>();
  if (voided) return respondWithSale(c, voided, 200);

  const current = await findSaleRow(c.env.DB, id);
  if (!current) throw notFound('Venta no encontrada');
  if (current.voided_at) throw conflict('La venta ya está anulada');
  throw forbidden('Solo el dueño puede anular ventas de una caja cerrada');
});
