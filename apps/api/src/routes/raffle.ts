import { Hono } from 'hono';
import { drawRaffleSchema, type PaginatedResult, type RaffleEntry } from '@sabor/shared';
import type { AppEnv } from '../env';
import type { RaffleDrawRow, RaffleEntryRow } from '../db/rows';
import { mapRaffleDraw, mapRaffleEntry } from '../db/rows';
import { requireAuth, requireRole } from '../middleware/auth';
import { badRequest } from '../lib/http-error';
import { parseBody } from '../lib/validate';
import { parsePositiveInt } from '../lib/params';
import { currentPeriod } from '../lib/period';

export const raffleRoutes = new Hono<AppEnv>();

const PAGE_SIZE_DEFAULT = 24;

// Admin: entradas de un período (default el mes actual), paginado igual que
// GET /orders — raffle_entries crece al mismo ritmo que los pedidos confirmados.
raffleRoutes.get('/entries', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const period = c.req.query('period') ?? currentPeriod();
  const page = Math.max(1, parsePositiveInt(c.req.query('page'), 1));
  const pageSize = Math.min(100, Math.max(1, parsePositiveInt(c.req.query('pageSize'), PAGE_SIZE_DEFAULT)));

  const countRow = await c.env.DB.prepare('SELECT COUNT(*) as total FROM raffle_entries WHERE period = ?')
    .bind(period)
    .first<{ total: number }>();
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM raffle_entries WHERE period = ? ORDER BY id ASC LIMIT ? OFFSET ?',
  )
    .bind(period, pageSize, (page - 1) * pageSize)
    .all<RaffleEntryRow>();

  const body: PaginatedResult<RaffleEntry> = {
    items: results.map(mapRaffleEntry),
    page,
    pageSize,
    total: countRow?.total ?? 0,
  };
  return c.json(body);
});

/**
 * Sortea el ganador de un período (solo owner). `ORDER BY RANDOM()` no es
 * criptográficamente seguro, pero es aceptable acá: es un sorteo promocional
 * de una pizzería, no un secreto de seguridad (BLUEPRINT/PLAN_IMPLEMENTACION.md).
 * No hay pre-chequeo de "¿ya se sorteó este período?": el UNIQUE(period) de
 * raffle_draws es el guard real — dos POST /draw concurrentes para el mismo
 * período solo pueden insertar uno, el otro falla por constraint y el
 * onError central lo traduce a 409 (mismo patrón que el email de customers).
 */
raffleRoutes.post('/draw', requireAuth, requireRole('owner'), async (c) => {
  const body = await parseBody(c, drawRaffleSchema);
  const period = body.period ?? currentPeriod();

  const winner = await c.env.DB.prepare(
    'SELECT id, customer_id FROM raffle_entries WHERE period = ? ORDER BY RANDOM() LIMIT 1',
  )
    .bind(period)
    .first<{ id: number; customer_id: number }>();
  if (!winner) throw badRequest(`No hay participantes para el período ${period}`);

  const actingUser = c.get('user');
  const draw = await c.env.DB.prepare(
    'INSERT INTO raffle_draws (period, winner_customer_id, winner_entry_id, drawn_by) VALUES (?, ?, ?, ?) RETURNING *',
  )
    .bind(period, winner.customer_id, winner.id, actingUser.id)
    .first<RaffleDrawRow>();
  return c.json(mapRaffleDraw(draw!), 201);
});
