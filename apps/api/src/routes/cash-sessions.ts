import { Hono } from 'hono';
import {
  closeSessionSchema,
  openSessionSchema,
  type CashSession,
  type CashSessionDetail,
  type PaginatedResult,
} from '@sabor/shared';
import type { AppEnv } from '../env';
import { mapCashSession, type CashSessionRow } from '../db/rows';
import { conflict, forbidden, notFound } from '../lib/http-error';
import { parseBody } from '../lib/validate';
import { parsePagination, requireIdParam } from '../lib/params';
import { closeCashSession } from '../lib/session-close';
import { computeSessionSummary } from '../lib/session-summary';
import { findOpenSession } from '../lib/sale-queries';
import { requireAuth, requireRole } from '../middleware/auth';

/** Caja del POS (D3): una sola sesión abierta a la vez. Owner/admin/cashier operan; el historial es de owner/admin. */
export const cashSessionRoutes = new Hono<AppEnv>();
cashSessionRoutes.use('*', requireAuth, requireRole('owner', 'admin', 'cashier'));

/** Sesión + resumen: el snapshot congelado si está cerrada, el cálculo en vivo si está abierta. */
async function toDetail(db: D1Database, row: CashSessionRow): Promise<CashSessionDetail> {
  const session = mapCashSession(row);
  const summary = session.closeSnapshot ?? (await computeSessionSummary(db, row));
  return { ...session, summary };
}

cashSessionRoutes.get('/current', async (c) => {
  const open = await findOpenSession(c.env.DB);
  return c.json(open ? await toDetail(c.env.DB, open) : null);
});

cashSessionRoutes.post('/', async (c) => {
  const body = await parseBody(c, openSessionSchema);
  const user = c.get('user');
  if (await findOpenSession(c.env.DB)) throw conflict('Ya hay una caja abierta');
  let row: CashSessionRow | null;
  try {
    row = await c.env.DB.prepare(
      'INSERT INTO cash_sessions (opened_by, opening_cash_cents, notes) VALUES (?, ?, ?) RETURNING *',
    )
      .bind(user.id, body.openingCashCents, body.notes)
      .first<CashSessionRow>();
  } catch (err) {
    // El índice único parcial es el árbitro final si dos abren a la vez.
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      throw conflict('Ya hay una caja abierta');
    }
    throw err;
  }
  return c.json(mapCashSession(row!), 201);
});

cashSessionRoutes.post('/:id/close', async (c) => {
  const id = requireIdParam(c);
  const body = await parseBody(c, closeSessionSchema);
  const session = await c.env.DB.prepare('SELECT * FROM cash_sessions WHERE id = ?').bind(id).first<CashSessionRow>();
  if (!session) throw notFound('Sesión de caja no encontrada');
  if (session.closed_at) throw conflict('La caja ya está cerrada');

  const closed = await closeCashSession(c.env.DB, session, {
    countedCashCents: body.countedCashCents,
    notes: body.notes,
    closedBy: c.get('user').id,
  });
  return c.json(await toDetail(c.env.DB, closed));
});

cashSessionRoutes.get('/', requireRole('owner', 'admin'), async (c) => {
  const { page, pageSize } = parsePagination(c);
  const [count, { results }] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) AS total FROM cash_sessions').first<{ total: number }>(),
    c.env.DB.prepare('SELECT * FROM cash_sessions ORDER BY opened_at DESC, id DESC LIMIT ? OFFSET ?')
      .bind(pageSize, (page - 1) * pageSize)
      .all<CashSessionRow>(),
  ]);
  const body: PaginatedResult<CashSession> = {
    items: results.map(mapCashSession),
    page,
    pageSize,
    total: count?.total ?? 0,
  };
  return c.json(body);
});

/** Ventana en la que el cajero aún puede ver (y compartir) el resumen de la caja que él mismo cerró. */
const CASHIER_RECENT_CLOSE_MS = 12 * 60 * 60 * 1000;

/** `closed_at` es UTC "YYYY-MM-DD HH:MM:SS" (sin zona). */
function closedWithin(closedAt: string, windowMs: number, now = Date.now()): boolean {
  const closedMs = new Date(`${closedAt.replace(' ', 'T')}Z`).getTime();
  return Number.isFinite(closedMs) && now - closedMs <= windowMs;
}

cashSessionRoutes.get('/:id', async (c) => {
  const id = requireIdParam(c);
  const row = await c.env.DB.prepare('SELECT * FROM cash_sessions WHERE id = ?').bind(id).first<CashSessionRow>();
  if (!row) throw notFound('Sesión de caja no encontrada');
  // El cajero ve la caja abierta y la que él mismo cerró hace poco; el historial es de owner/admin.
  const user = c.get('user');
  if (user.role === 'cashier' && row.closed_at) {
    const closedByMe = row.closed_by === user.id && closedWithin(row.closed_at, CASHIER_RECENT_CLOSE_MS);
    if (!closedByMe) throw forbidden();
  }
  return c.json(await toDetail(c.env.DB, row));
});
