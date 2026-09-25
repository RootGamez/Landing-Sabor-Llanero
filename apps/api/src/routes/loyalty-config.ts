import { Hono } from 'hono';
import { loyaltyConfigUpdateSchema } from '@sabor/shared';
import type { AppEnv } from '../env';
import type { LoyaltyConfigRow } from '../db/rows';
import { mapLoyaltyConfig } from '../db/rows';
import { requireAuth, requireRole } from '../middleware/auth';
import { badRequest, notFound } from '../lib/http-error';
import { parseBody } from '../lib/validate';

export const loyaltyConfigRoutes = new Hono<AppEnv>();

// Público (calco de routes/whatsapp.ts): la web necesita points_per_currency_unit
// para mostrarle al cliente cuántos puntos gana antes de confirmar el pedido.
loyaltyConfigRoutes.get('/', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM loyalty_config ORDER BY id LIMIT 1').first<LoyaltyConfigRow>();
  if (!row) throw notFound('Configuración de puntos no inicializada');
  return c.json(mapLoyaltyConfig(row));
});

loyaltyConfigRoutes.patch('/', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const body = await parseBody(c, loyaltyConfigUpdateSchema);
  const current = await c.env.DB.prepare('SELECT * FROM loyalty_config ORDER BY id LIMIT 1').first<LoyaltyConfigRow>();
  if (!current) throw badRequest('Configuración de puntos no inicializada (falta seed)');

  const updated = await c.env.DB.prepare(
    `UPDATE loyalty_config SET
      points_per_currency_unit = ?, min_order_amount_for_points = ?, updated_at = datetime('now')
     WHERE id = ? RETURNING *`,
  )
    .bind(
      body.pointsPerCurrencyUnit ?? current.points_per_currency_unit,
      body.minOrderAmountForPoints ?? current.min_order_amount_for_points,
      current.id,
    )
    .first<LoyaltyConfigRow>();
  return c.json(mapLoyaltyConfig(updated!));
});
