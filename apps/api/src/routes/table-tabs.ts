import { Hono, type Context } from 'hono';
import {
  DEFAULT_PAYMENT_METHOD,
  closeTabSchema,
  flavorIdsOf,
  parseSaleItemFlavors,
  saveTabSchema,
  tableDisplayName,
  voidTabSchema,
  type DiningTab,
  type Sale,
} from '@sabor/shared';
import type { AppEnv } from '../env';
import { badRequest, conflict, forbidden, notFound } from '../lib/http-error';
import { assertPaymentMethodActive } from '../lib/payment-method-check';
import { parseBody } from '../lib/validate';
import { requireIdParam } from '../lib/params';
import { insertSale, lineExtras } from '../lib/sale-create';
import { priceCartLines, sumLines, type SaleLine } from '../lib/sale-pricing';
import { findOpenSession, findSaleRow, hydrateSales } from '../lib/sale-queries';
import { diffTabItems } from '../lib/dining-tab-diff';
import {
  findOpenTabRow,
  findTableRow,
  findTabRow,
  loadTab,
  loadTabItems,
  type DiningTabItemRow,
  type DiningTabRow,
  type DiningTableRow,
} from '../lib/dining-queries';
import { requireRole } from '../middleware/auth';
import { resolveCashReceived } from './sales';

/**
 * Cuenta de una mesa: `/tables/:id/tab`. Todo el staff toma pedidos y cobra;
 * reducir lo ya guardado o anular la cuenta es de owner/admin (equivale a un
 * descuento/anulación). Una cuenta abierta NO es venta: recién al cobrar nace
 * la fila en `sales` (y con ella el ingreso en cierres y reportes).
 */
export const tableTabRoutes = new Hono<AppEnv>();
// Se monta DENTRO de `tableRoutes` (routes/tables.ts), que ya aplica requireAuth +
// roles de staff a todo `/tables/*`; acá solo se suman las restricciones extra.

const CHANGED_ELSEWHERE = 'La cuenta de la mesa cambió en otro dispositivo. Revisa la versión actual y vuelve a intentarlo.';

/** Condición "la cuenta sigue abierta y en la versión que vio el cliente", identificada por su client_uuid. */
const OPEN_AT_VERSION = "client_uuid = ? AND status = 'open' AND version = ?";

async function requireTable(c: Context<AppEnv>): Promise<DiningTableRow> {
  const table = await findTableRow(c.env.DB, requireIdParam(c));
  if (!table) throw notFound('Mesa no encontrada');
  return table;
}

async function respondWithSale(c: Context<AppEnv>, saleId: number, status: 200 | 201): Promise<Response> {
  const row = await findSaleRow(c.env.DB, saleId);
  if (!row) throw notFound('Venta no encontrada');
  const [sale] = await hydrateSales(c.env.DB, [row]);
  return c.json(sale as Sale, status);
}

tableTabRoutes.get('/:id/tab', async (c) => {
  const table = await requireTable(c);
  const open = await findOpenTabRow(c.env.DB, table.id);
  return c.json(open ? ((await loadTab(c.env.DB, open)) satisfies DiningTab) : null);
});

interface SaveTarget {
  clientUuid: string;
  version: number;
  existing: DiningTabItemRow[];
  isNew: boolean;
}

/** Resuelve qué cuenta se guarda y verifica que el cliente vio la versión vigente (control optimista). */
async function resolveSaveTarget(db: D1Database, table: DiningTableRow, expectedVersion: number | null): Promise<SaveTarget> {
  const open = await findOpenTabRow(db, table.id);
  const name = tableDisplayName(table.label);
  if (expectedVersion === null) {
    if (open) throw conflict(`${name} ya tiene una cuenta abierta por otra persona. Revisa la cuenta actual.`);
    if (table.is_active !== 1) throw conflict(`${name} está desactivada`);
    return { clientUuid: crypto.randomUUID(), version: 0, existing: [], isNew: true };
  }
  if (!open) throw conflict(`La cuenta de ${name} ya se cobró o se anuló.`);
  if (open.version !== expectedVersion) throw conflict(CHANGED_ELSEWHERE);
  return { clientUuid: open.client_uuid, version: open.version, existing: await loadTabItems(db, open.id), isNew: false };
}

function buildSaveStatements(
  db: D1Database,
  table: DiningTableRow,
  target: SaveTarget,
  userId: number,
  diff: ReturnType<typeof diffTabItems>,
  priced: readonly SaleLine[],
): D1PreparedStatement[] {
  const guardParams = [target.clientUuid, target.version] as const;
  const tabIdOf = `(SELECT id FROM dining_tabs WHERE ${OPEN_AT_VERSION})`;
  const statements: D1PreparedStatement[] = [];
  if (target.isNew) {
    // La cuenta nace solo si la mesa sigue activa; el índice único parcial rechaza una segunda abierta.
    statements.push(
      db
        .prepare(
          `INSERT INTO dining_tabs (table_id, client_uuid, opened_by, updated_by)
           SELECT id, ?, ?, ? FROM dining_tables WHERE id = ? AND is_active = 1`,
        )
        .bind(target.clientUuid, userId, userId, table.id),
    );
  }
  for (const line of priced) {
    // Sabores/nota (0011) solo se nombran si la línea los trae (misma regla que sale_items).
    const extras = lineExtras(line);
    statements.push(
      db
        .prepare(
          `INSERT INTO dining_tab_items (tab_id, item_id, size_id, name, size_label, unit_price_cents, quantity${extras.columns})
           SELECT id, ?, ?, ?, ?, ?, ?${extras.placeholders} FROM dining_tabs WHERE ${OPEN_AT_VERSION}`,
        )
        .bind(
          line.itemId,
          line.sizeId,
          line.name,
          line.sizeLabel,
          line.unitPriceCents,
          line.quantity,
          ...extras.values,
          ...guardParams,
        ),
    );
  }
  for (const update of diff.updates) {
    statements.push(
      db
        .prepare(`UPDATE dining_tab_items SET quantity = ?, updated_at = datetime('now') WHERE id = ? AND tab_id = ${tabIdOf}`)
        .bind(update.quantity, update.id, ...guardParams),
    );
  }
  for (const id of diff.deletes) {
    statements.push(db.prepare(`DELETE FROM dining_tab_items WHERE id = ? AND tab_id = ${tabIdOf}`).bind(id, ...guardParams));
  }
  // La versión sube AL FINAL: todas las sentencias anteriores ven la misma condición
  // (el batch es una transacción serializada), así que o se aplica todo o nada.
  statements.push(
    db
      .prepare(
        `UPDATE dining_tabs SET version = version + 1, updated_at = datetime('now'), updated_by = ?
          WHERE ${OPEN_AT_VERSION}`,
      )
      .bind(userId, ...guardParams),
  );
  return statements;
}

/**
 * Guardar pedido (una "tanda"): el cliente manda la lista COMPLETA deseada.
 * Lo nuevo se tasa server-side; lo ya guardado conserva su precio. Abre la
 * cuenta si la mesa estaba libre. No exige caja abierta: el ingreso recién
 * existe al cobrar, y ahí sí se exige.
 */
tableTabRoutes.put('/:id/tab', async (c) => {
  const table = await requireTable(c);
  const body = await parseBody(c, saveTabSchema);
  const user = c.get('user');
  const db = c.env.DB;

  const target = await resolveSaveTarget(db, table, body.expectedVersion);
  const diff = diffTabItems(
    target.existing.map((row) => ({
      id: row.id,
      itemId: row.item_id,
      sizeId: row.size_id,
      quantity: row.quantity,
      flavors: flavorIdsOf(parseSaleItemFlavors(row.flavors_json)),
      note: row.note ?? null,
    })),
    body.items,
  );
  if (diff.reducesSaved && user.role === 'cashier') {
    throw forbidden('Solo el dueño o un administrador puede quitar productos ya guardados en la cuenta');
  }
  const hasChanges = target.isNew || diff.inserts.length + diff.updates.length + diff.deletes.length > 0;
  if (!hasChanges) {
    const open = await findOpenTabRow(db, table.id);
    return c.json((await loadTab(db, open!)) satisfies DiningTab);
  }

  const priced = diff.inserts.length > 0 ? await priceCartLines(db, diff.inserts) : [];
  let results: D1Result[];
  try {
    results = await db.batch(buildSaveStatements(db, table, target, user.id, diff, priced));
  } catch (err) {
    const text = err instanceof Error ? `${err.message} ${err.cause instanceof Error ? err.cause.message : ''}` : '';
    if (text.includes('dining_tabs.table_id')) {
      throw conflict(`${tableDisplayName(table.label)} ya tiene una cuenta abierta por otra persona. Revisa la cuenta actual.`);
    }
    throw err;
  }
  if (results[results.length - 1]?.meta.changes === 0) {
    if (target.isNew) throw conflict(`${tableDisplayName(table.label)} está desactivada`);
    throw conflict(CHANGED_ELSEWHERE);
  }

  const saved = await findOpenTabRow(db, table.id);
  if (!saved) throw conflict(CHANGED_ELSEWHERE);
  return c.json((await loadTab(db, saved)) satisfies DiningTab, target.isNew ? 201 : 200);
});

async function requireTabOfTable(db: D1Database, tableId: number, tabId: number): Promise<DiningTabRow> {
  const tab = await findTabRow(db, tabId);
  if (!tab || tab.table_id !== tableId) throw notFound('Cuenta no encontrada');
  return tab;
}

function toSaleLines(items: readonly DiningTabItemRow[]): SaleLine[] {
  return items.map((item) => ({
    itemId: item.item_id,
    sizeId: item.size_id,
    name: item.name,
    sizeLabel: item.size_label,
    unitPriceCents: item.unit_price_cents,
    quantity: item.quantity,
    // El cobro copia a la venta los sabores (snapshot ya tasado al guardar) y la nota.
    flavors: parseSaleItemFlavors(item.flavors_json),
    note: item.note ?? null,
  }));
}

/**
 * Cerrar mesa = cobrar. Atómico (un `DB.batch`): la venta nace solo si la
 * cuenta sigue abierta en la versión vista y la caja abierta; en la misma
 * transacción la cuenta pasa a 'paid' con su `sale_id` (la mesa queda libre).
 * Idempotente: la venta usa el client_uuid de la cuenta (UNIQUE en `sales`) y
 * un reintento sobre una cuenta ya cobrada devuelve la misma venta.
 */
tableTabRoutes.post('/:id/tab/close', async (c) => {
  const table = await requireTable(c);
  const body = await parseBody(c, closeTabSchema);
  const user = c.get('user');
  const db = c.env.DB;
  if (body.discountCents > 0 && user.role === 'cashier') throw forbidden('El cajero no puede aplicar descuentos');

  const tab = await requireTabOfTable(db, table.id, body.tabId);
  if (tab.status === 'paid' && tab.sale_id !== null) return respondWithSale(c, tab.sale_id, 200);
  if (tab.status === 'void') throw conflict('La cuenta fue anulada');
  if (tab.version !== body.expectedVersion) throw conflict(CHANGED_ELSEWHERE);

  const session = await findOpenSession(db);
  if (!session) throw conflict('Abre la caja antes de cobrar');
  const paymentMethod = body.paymentMethod ?? DEFAULT_PAYMENT_METHOD;
  await assertPaymentMethodActive(db, paymentMethod);

  const lines = toSaleLines(await loadTabItems(db, tab.id));
  if (lines.length === 0) throw badRequest('La cuenta no tiene productos');
  const subtotalCents = sumLines(lines);
  if (body.discountCents > subtotalCents) throw badRequest('El descuento no puede superar el subtotal');
  const cashReceivedCents = resolveCashReceived(body, paymentMethod, subtotalCents - body.discountCents);

  const markPaid = db
    .prepare(
      `UPDATE dining_tabs
          SET status = 'paid', sale_id = (SELECT id FROM sales WHERE client_uuid = ?1),
              closed_at = datetime('now'), closed_by = ?2, updated_at = datetime('now'), updated_by = ?2
        WHERE id = ?3 AND status = 'open' AND version = ?4
          AND EXISTS (SELECT 1 FROM sales WHERE client_uuid = ?1)`,
    )
    .bind(tab.client_uuid, user.id, tab.id, body.expectedVersion);
  const result = await insertSale(db, {
    sessionId: session.id,
    createdBy: user.id,
    paymentMethod,
    discountCents: body.discountCents,
    cashReceivedCents,
    orderId: null,
    clientUuid: tab.client_uuid,
    lines,
    guard: {
      sql: "EXISTS (SELECT 1 FROM dining_tabs WHERE id = ? AND status = 'open' AND version = ?)",
      params: [tab.id, body.expectedVersion],
    },
    after: [markPaid],
  });

  const after = await findTabRow(db, tab.id);
  if (after?.status === 'paid' && after.sale_id !== null) {
    return respondWithSale(c, after.sale_id, result === 'created' ? 201 : 200);
  }
  if (after?.status === 'void') throw conflict('La cuenta fue anulada');
  if (!(await findOpenSession(db))) throw conflict('La caja se cerró, abre una nueva para cobrar');
  throw conflict(CHANGED_ELSEWHERE);
});

/** Anular la cuenta (owner/admin, con motivo): libera la mesa sin generar venta ni ingreso. Idempotente. */
tableTabRoutes.post('/:id/tab/void', requireRole('owner', 'admin'), async (c) => {
  const table = await requireTable(c);
  const body = await parseBody(c, voidTabSchema);
  const user = c.get('user');
  const db = c.env.DB;

  const voided = await db
    .prepare(
      `UPDATE dining_tabs
          SET status = 'void', void_reason = ?1, closed_at = datetime('now'), closed_by = ?2,
              updated_at = datetime('now'), updated_by = ?2
        WHERE id = ?3 AND table_id = ?4 AND status = 'open'
      RETURNING *`,
    )
    .bind(body.reason, user.id, body.tabId, table.id)
    .first<DiningTabRow>();
  if (voided) return c.json((await loadTab(db, voided)) satisfies DiningTab);

  const tab = await requireTabOfTable(db, table.id, body.tabId);
  if (tab.status === 'paid') throw conflict('La cuenta ya se cobró: anula la venta desde Ventas del turno');
  return c.json((await loadTab(db, tab)) satisfies DiningTab);
});
