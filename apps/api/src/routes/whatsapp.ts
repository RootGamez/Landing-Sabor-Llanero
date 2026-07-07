import { Hono } from 'hono';
import { whatsappUpdateSchema } from '@sabor/shared';
import type { AppEnv } from '../env';
import type { WhatsappRow } from '../db/rows';
import { mapWhatsapp } from '../db/rows';
import { requireAuth, requireRole } from '../middleware/auth';
import { badRequest, notFound } from '../lib/http-error';
import { parseBody } from '../lib/validate';

export const whatsappRoutes = new Hono<AppEnv>();

whatsappRoutes.get('/', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM whatsapp_config ORDER BY id LIMIT 1').first<
    WhatsappRow
  >();
  if (!row) throw notFound('Configuración de WhatsApp no inicializada');
  return c.json(mapWhatsapp(row));
});

whatsappRoutes.patch('/', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const body = await parseBody(c, whatsappUpdateSchema);
  const current = await c.env.DB.prepare('SELECT * FROM whatsapp_config ORDER BY id LIMIT 1').first<
    WhatsappRow
  >();
  if (!current) throw badRequest('Configuración de WhatsApp no inicializada (falta seed)');

  const updated = await c.env.DB.prepare(
    `UPDATE whatsapp_config SET
      phone_number = ?, message_template_es = ?, message_template_en = ?, updated_at = datetime('now')
     WHERE id = ? RETURNING *`,
  )
    .bind(
      body.phoneNumber ?? current.phone_number,
      body.messageTemplateEs ?? current.message_template_es,
      body.messageTemplateEn ?? current.message_template_en,
      current.id,
    )
    .first<WhatsappRow>();
  return c.json(mapWhatsapp(updated!));
});
