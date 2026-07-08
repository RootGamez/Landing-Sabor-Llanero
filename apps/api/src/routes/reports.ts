import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAuth, requireRole } from '../middleware/auth';
import { badRequest } from '../lib/http-error';

// Alcance recortado (BLUEPRINT §4.4/§7.1): sin low-stock ni most-viewed —
// el catálogo es vitrina sin stock, y "view" no se registra por defecto.
export const reportRoutes = new Hono<AppEnv>();
reportRoutes.use('*', requireAuth, requireRole('owner', 'admin'));

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Rango de fechas opcional, mismo formato en los reportes (patrón de Jaw). */
function dateRange(c: { req: { query: (k: string) => string | undefined } }) {
  const fromParam = c.req.query('from');
  const toParam = c.req.query('to');
  if (fromParam !== undefined && !DATE_ONLY_REGEX.test(fromParam)) {
    throw badRequest('from inválido (formato esperado: YYYY-MM-DD)');
  }
  if (toParam !== undefined && !DATE_ONLY_REGEX.test(toParam)) {
    throw badRequest('to inválido (formato esperado: YYYY-MM-DD)');
  }
  const from = fromParam ?? '0000-01-01'; // ISO date, inclusivo
  const to = toParam ?? '9999-12-31';
  // Se compara por rango sobre la columna cruda ('YYYY-MM-DD HH:MM:SS') en vez de
  // envolverla con date(), para poder usar idx_events_type_date. El límite
  // superior incluye todo el día indicado.
  return { from, toEnd: `${to} 23:59:59` };
}

reportRoutes.get('/order-clicks', async (c) => {
  const { from, toEnd } = dateRange(c);
  const { results } = await c.env.DB.prepare(
    `SELECT mi.id as itemId, mi.name_es as nameEs, mi.name_en as nameEn, COUNT(e.id) as clicks
     FROM events e
     JOIN menu_items mi ON mi.id = e.item_id
     WHERE e.type = 'order_click' AND e.created_at >= ? AND e.created_at <= ?
     GROUP BY mi.id
     ORDER BY clicks DESC`,
  )
    .bind(from, toEnd)
    .all();
  return c.json(results);
});

reportRoutes.get('/by-category', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT c.id as categoryId, c.name_es as nameEs, c.name_en as nameEn, COUNT(mi.id) as total
     FROM categories c
     LEFT JOIN menu_items mi ON mi.category_id = c.id AND mi.is_active = 1
     GROUP BY c.id
     ORDER BY c.display_order ASC`,
  ).all();
  return c.json(results);
});
