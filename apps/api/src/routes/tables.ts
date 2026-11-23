import { Hono } from 'hono';
import {
  diningTableCreateSchema,
  diningTableUpdateSchema,
  findOverlap,
  fitsInPlan,
  tableDisplayName,
  type DiningTable,
  type PlanRect,
} from '@sabor/shared';
import type { AppEnv } from '../env';
import { badRequest, conflict, notFound } from '../lib/http-error';
import { parseBody } from '../lib/validate';
import { requireIdParam } from '../lib/params';
import { findTableRow, listTableStatuses, mapDiningTable, type DiningTableRow } from '../lib/dining-queries';
import { requireAuth, requireRole } from '../middleware/auth';
import { tableTabRoutes } from './table-tabs';

/**
 * Plano de mesas. Todo el staff ve el mapa (con el estado de cada mesa);
 * solo owner/admin crean, mueven, redimensionan, renombran o desactivan.
 */
export const tableRoutes = new Hono<AppEnv>();
tableRoutes.use('*', requireAuth, requireRole('owner', 'admin', 'cashier'));

const MAX_TABLES = 60;

function isLabelConflict(err: unknown): boolean {
  return err instanceof Error && err.message.includes('dining_tables.label');
}

/** Valida que la mesa quepa en el plano y no pise a otra mesa activa. */
async function assertPlacement(db: D1Database, rect: PlanRect, selfId?: number): Promise<void> {
  if (!fitsInPlan(rect)) throw badRequest('La mesa no cabe en el plano en esa posición');
  const { results } = await db
    .prepare('SELECT * FROM dining_tables WHERE is_active = 1')
    .all<DiningTableRow>();
  const overlap = findOverlap(rect, results, selfId);
  if (overlap) throw conflict(`La mesa se superpone con ${tableDisplayName(overlap.label)}`);
}

tableRoutes.get('/', async (c) => {
  const wantsAll = c.req.query('all') === '1';
  const canSeeInactive = c.get('user').role !== 'cashier';
  return c.json(await listTableStatuses(c.env.DB, wantsAll && canSeeInactive));
});

tableRoutes.post('/', requireRole('owner', 'admin'), async (c) => {
  const body = await parseBody(c, diningTableCreateSchema);
  const db = c.env.DB;
  const count = await db.prepare('SELECT COUNT(*) AS n FROM dining_tables').first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_TABLES) throw conflict(`El plano admite como máximo ${MAX_TABLES} mesas`);
  await assertPlacement(db, body);

  const order =
    body.displayOrder ??
    ((await db.prepare('SELECT COALESCE(MAX(display_order), 0) + 1 AS n FROM dining_tables').first<{ n: number }>())?.n ?? 1);
  try {
    const row = await db
      .prepare(
        `INSERT INTO dining_tables (label, x, y, w, h, shape, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      )
      .bind(body.label, body.x, body.y, body.w, body.h, body.shape, order)
      .first<DiningTableRow>();
    return c.json(mapDiningTable(row!) satisfies DiningTable, 201);
  } catch (err) {
    if (isLabelConflict(err)) throw conflict('Ya existe una mesa con ese nombre');
    throw err;
  }
});

tableRoutes.patch('/:id', requireRole('owner', 'admin'), async (c) => {
  const id = requireIdParam(c);
  const body = await parseBody(c, diningTableUpdateSchema);
  const db = c.env.DB;
  const current = await findTableRow(db, id);
  if (!current) throw notFound('Mesa no encontrada');

  const next = {
    label: body.label ?? current.label,
    x: body.x ?? current.x,
    y: body.y ?? current.y,
    w: body.w ?? current.w,
    h: body.h ?? current.h,
    shape: body.shape ?? current.shape,
    displayOrder: body.displayOrder ?? current.display_order,
    isActive: body.isActive ?? current.is_active === 1,
  };
  if (next.isActive) await assertPlacement(db, next, id);
  else if (!fitsInPlan(next)) throw badRequest('La mesa no cabe en el plano en esa posición');

  let row: DiningTableRow | null;
  try {
    // Desactivar una mesa con cuenta abierta dejaría esa cuenta invisible en el mapa:
    // la regla vive en el UPDATE (sin ventana de carrera con quien abre la mesa).
    row = await db
      .prepare(
        `UPDATE dining_tables
            SET label = ?1, x = ?2, y = ?3, w = ?4, h = ?5, shape = ?6, display_order = ?7,
                is_active = ?8, updated_at = datetime('now')
          WHERE id = ?9
            AND (?8 = 1 OR NOT EXISTS (SELECT 1 FROM dining_tabs WHERE table_id = ?9 AND status = 'open'))
        RETURNING *`,
      )
      .bind(next.label, next.x, next.y, next.w, next.h, next.shape, next.displayOrder, next.isActive ? 1 : 0, id)
      .first<DiningTableRow>();
  } catch (err) {
    if (isLabelConflict(err)) throw conflict('Ya existe una mesa con ese nombre');
    throw err;
  }
  if (!row) throw conflict('La mesa tiene una cuenta abierta: cóbrala o anúlala antes de desactivarla');
  return c.json(mapDiningTable(row) satisfies DiningTable);
});

// Cuenta de cada mesa: /tables/:id/tab (hereda la autenticación de arriba).
tableRoutes.route('/', tableTabRoutes);
