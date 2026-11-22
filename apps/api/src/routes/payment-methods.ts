import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { mapPaymentMethod, type PaymentMethodRow } from '../db/rows';
import { requireAuth, requireRole } from '../middleware/auth';

/** Métodos de pago activos, para el selector del POS y de gastos (solo staff). */
export const paymentMethodRoutes = new Hono<AppEnv>();

paymentMethodRoutes.get('/', requireAuth, requireRole('owner', 'admin', 'cashier'), async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY display_order ASC, key ASC',
  ).all<PaymentMethodRow>();
  return c.json(results.map(mapPaymentMethod));
});
