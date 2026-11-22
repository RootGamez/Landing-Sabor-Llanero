import { Hono } from 'hono';
import {
  expenseSchema,
  expenseUpdateSchema,
  type Expense,
  type ExpenseDayTotal,
  type ExpenseListResult,
  type ExpenseUpdateInput,
} from '@sabor/shared';
import type { AppEnv } from '../env';
import { mapExpense, type ExpenseRow } from '../db/rows';
import { buildExpenseFilters } from '../lib/expense-filters';
import { assertCashRegisterMethod, assertCategoryActive } from '../lib/expense-rules';
import { conflict, forbidden, notFound } from '../lib/http-error';
import { parsePagination, requireIdParam } from '../lib/params';
import { assertPaymentMethodActive } from '../lib/payment-method-check';
import { findOpenSession } from '../lib/sale-queries';
import { refreshClosedSessionSnapshot } from '../lib/session-refresh';
import { parseBody } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';

/** Gastos (D10): solo owner/admin. El cajero no ve ni registra egresos. */
export const expenseRoutes = new Hono<AppEnv>();
expenseRoutes.use('*', requireAuth, requireRole('owner', 'admin'));

const NO_OPEN_SESSION = 'Abre la caja para registrar gastos pagados de caja';
/** Condición SQL: el gasto no descuenta efectivo de una caja ya cerrada (solo el owner puede modificar esos). */
const NOT_IN_CLOSED_SESSION = `(expenses.paid_from_register = 0 OR expenses.session_id IS NULL
  OR EXISTS (SELECT 1 FROM cash_sessions cs WHERE cs.id = expenses.session_id AND cs.closed_at IS NULL))`;
const DEFAULT_PAGE_SIZE = 50;

/** Total diario de los días de la página (orden por fecha desc → son un rango contiguo; sin `IN (...)` por el tope de parámetros de D1). */
async function loadDayTotals(
  db: D1Database,
  where: string,
  params: Array<string | number>,
  dates: string[],
): Promise<ExpenseDayTotal[]> {
  if (dates.length === 0) return [];
  const { results } = await db
    .prepare(
      `SELECT e.date AS date, SUM(e.amount_cents) AS totalCents FROM expenses e
        ${where} AND e.date BETWEEN ? AND ?
        GROUP BY e.date ORDER BY e.date DESC`,
    )
    .bind(...params, dates[dates.length - 1], dates[0])
    .all<ExpenseDayTotal>();
  return results;
}

expenseRoutes.get('/', async (c) => {
  const { page, pageSize } = parsePagination(c, DEFAULT_PAGE_SIZE);
  const { where, params } = buildExpenseFilters(c);
  const db = c.env.DB;
  const [totals, { results }] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(e.amount_cents), 0) AS totalCents FROM expenses e ${where}`)
      .bind(...params)
      .first<{ total: number; totalCents: number }>(),
    db
      .prepare(`SELECT e.* FROM expenses e ${where} ORDER BY e.date DESC, e.id DESC LIMIT ? OFFSET ?`)
      .bind(...params, pageSize, (page - 1) * pageSize)
      .all<ExpenseRow>(),
  ]);
  const body: ExpenseListResult = {
    items: results.map(mapExpense),
    page,
    pageSize,
    total: totals?.total ?? 0,
    totalCents: totals?.totalCents ?? 0,
    dayTotals: await loadDayTotals(db, where, params, [...new Set(results.map((r) => r.date))]),
  };
  return c.json(body);
});

/**
 * Alta atómica: un gasto "de caja" solo se inserta si hay caja abierta en ese
 * mismo statement (sin ventana de carrera con el cierre) y toma su session_id.
 */
expenseRoutes.post('/', async (c) => {
  const body = await parseBody(c, expenseSchema);
  const db = c.env.DB;
  assertCashRegisterMethod(body);
  await assertCategoryActive(db, body.categoryId);
  await assertPaymentMethodActive(db, body.paymentMethod);

  const row = await db
    .prepare(
      `INSERT INTO expenses (date, amount_cents, category_id, description, payment_method, paid_from_register, session_id, created_by)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, CASE WHEN ?6 = 1 THEN (SELECT id FROM cash_sessions WHERE closed_at IS NULL) END, ?7
        WHERE ?6 = 0 OR EXISTS (SELECT 1 FROM cash_sessions WHERE closed_at IS NULL)
       RETURNING *`,
    )
    .bind(
      body.date,
      body.amountCents,
      body.categoryId,
      body.description,
      body.paymentMethod,
      body.paidFromRegister ? 1 : 0,
      c.get('user').id,
    )
    .first<ExpenseRow>();
  if (!row) throw conflict(NO_OPEN_SESSION);
  return c.json(mapExpense(row), 201);
});

async function findLiveExpense(db: D1Database, id: number): Promise<ExpenseRow> {
  const row = await db
    .prepare('SELECT * FROM expenses WHERE id = ? AND deleted_at IS NULL')
    .bind(id)
    .first<ExpenseRow>();
  if (!row) throw notFound('Gasto no encontrado');
  return row;
}

/** `true` si el gasto descuenta efectivo de una caja que ya se cerró. */
async function affectsClosedSession(db: D1Database, row: ExpenseRow): Promise<boolean> {
  if (!row.paid_from_register || row.session_id === null) return false;
  const session = await db
    .prepare('SELECT closed_at FROM cash_sessions WHERE id = ?')
    .bind(row.session_id)
    .first<{ closed_at: string | null }>();
  return session?.closed_at != null;
}

interface ExpenseState {
  date: string;
  amountCents: number;
  categoryId: number;
  description: string;
  paymentMethod: string;
  paidFromRegister: boolean;
}

function merged(row: ExpenseRow, patch: ExpenseUpdateInput): ExpenseState {
  return {
    date: patch.date ?? row.date,
    amountCents: patch.amountCents ?? row.amount_cents,
    categoryId: patch.categoryId ?? row.category_id,
    description: patch.description ?? row.description,
    paymentMethod: patch.paymentMethod ?? row.payment_method,
    paidFromRegister: patch.paidFromRegister ?? Boolean(row.paid_from_register),
  };
}

/** Cambiar el monto, o dejar de ser "de caja", mueve el efectivo esperado de la sesión del gasto. */
function movesCash(row: ExpenseRow, next: ExpenseState): boolean {
  return Boolean(row.paid_from_register) && (next.amountCents !== row.amount_cents || !next.paidFromRegister);
}

/** Sesión a la que queda ligado el gasto tras la edición (null si deja de ser "de caja"). */
async function resolveSessionId(db: D1Database, row: ExpenseRow, next: ExpenseState): Promise<number | null> {
  if (!next.paidFromRegister) return null;
  if (row.paid_from_register) return row.session_id;
  const open = await findOpenSession(db);
  if (!open) throw conflict(NO_OPEN_SESSION);
  return open.id;
}

async function assertPatchAllowed(
  db: D1Database,
  role: string,
  row: ExpenseRow,
  patch: ExpenseUpdateInput,
  next: ExpenseState,
): Promise<void> {
  assertCashRegisterMethod(next);
  if (patch.categoryId !== undefined && patch.categoryId !== row.category_id) {
    await assertCategoryActive(db, patch.categoryId);
  }
  if (patch.paymentMethod !== undefined) await assertPaymentMethodActive(db, patch.paymentMethod);
  if (movesCash(row, next) && role !== 'owner' && (await affectsClosedSession(db, row))) {
    throw forbidden('Solo el dueño puede modificar gastos de una caja cerrada');
  }
}

expenseRoutes.patch('/:id', async (c) => {
  const id = requireIdParam(c);
  const patch = await parseBody(c, expenseUpdateSchema);
  const db = c.env.DB;
  const current = await findLiveExpense(db, id);
  const next = merged(current, patch);
  await assertPatchAllowed(db, c.get('user').role, current, patch, next);

  const newlyPaid = next.paidFromRegister && !current.paid_from_register;
  // Quien no es owner no puede tocar el efectivo de una caja cerrada: la regla también va en el UPDATE (sin carrera con el cierre).
  const ownerOnlyChange = c.get('user').role === 'owner' || !movesCash(current, next);
  const sessionId = await resolveSessionId(db, current, next);
  // Al ligarse a una caja, el UPDATE exige que siga abierta (sin carrera con el cierre).
  const updated = await db
    .prepare(
      `UPDATE expenses SET date = ?1, amount_cents = ?2, category_id = ?3, description = ?4,
              payment_method = ?5, paid_from_register = ?6, session_id = ?7
        WHERE id = ?8 AND deleted_at IS NULL
          AND (?9 = 0 OR EXISTS (SELECT 1 FROM cash_sessions WHERE id = ?7 AND closed_at IS NULL))
          AND (?10 = 0 OR ${NOT_IN_CLOSED_SESSION})
        RETURNING *`,
    )
    .bind(
      next.date,
      next.amountCents,
      next.categoryId,
      next.description,
      next.paymentMethod,
      next.paidFromRegister ? 1 : 0,
      sessionId,
      id,
      newlyPaid ? 1 : 0,
      ownerOnlyChange ? 0 : 1,
    )
    .first<ExpenseRow>();
  if (!updated) throw conflict(newlyPaid ? NO_OPEN_SESSION : 'El gasto cambió o su caja se cerró, intenta de nuevo');
  if (current.paid_from_register && current.session_id !== null) {
    await refreshClosedSessionSnapshot(db, current.session_id);
  }
  return c.json(mapExpense(updated) satisfies Expense);
});

expenseRoutes.delete('/:id', async (c) => {
  const id = requireIdParam(c);
  const db = c.env.DB;
  const current = await findLiveExpense(db, id);
  if (c.get('user').role !== 'owner' && (await affectsClosedSession(db, current))) {
    throw forbidden('Solo el dueño puede eliminar gastos de una caja cerrada');
  }
  const isOwner = c.get('user').role === 'owner' ? 1 : 0;
  const deleted = await db
    .prepare(
      `UPDATE expenses SET deleted_at = datetime('now')
        WHERE id = ?1 AND deleted_at IS NULL AND (?2 = 1 OR ${NOT_IN_CLOSED_SESSION}) RETURNING id`,
    )
    .bind(id, isOwner)
    .first();
  if (!deleted) throw conflict('El gasto cambió o su caja se cerró, intenta de nuevo');
  if (current.paid_from_register && current.session_id !== null) {
    await refreshClosedSessionSnapshot(db, current.session_id);
  }
  return c.json({ id });
});
