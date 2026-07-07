import { Hono } from 'hono';
import { registerEventSchema } from '@sabor/shared';
import type { AppEnv } from '../env';
import { notFound } from '../lib/http-error';
import { parseBody } from '../lib/validate';
import { rateLimit } from '../middleware/rate-limit';

export const eventRoutes = new Hono<AppEnv>();

// Endpoint público: rate limit por IP para evitar flood de inserts (analíticas
// envenenadas + costo de escritura en D1).
eventRoutes.post('/', rateLimit((env) => env.EVENTS_LIMITER), async (c) => {
  const { itemId, type } = await parseBody(c, registerEventSchema);

  // Verificar que el ítem exista antes de insertar: evita basura en la tabla
  // events y filas que romperían los JOIN de los reportes.
  const item = await c.env.DB.prepare('SELECT id FROM menu_items WHERE id = ?').bind(itemId).first();
  if (!item) throw notFound('Ítem no encontrado');

  await c.env.DB.prepare('INSERT INTO events (item_id, type) VALUES (?, ?)').bind(itemId, type).run();
  return c.body(null, 201);
});
