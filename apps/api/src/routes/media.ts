import { Hono } from 'hono';
import {
  ALLOWED_MEDIA_MIME,
  MEDIA_KEY_PREFIX,
  MEDIA_MAX_UPLOAD_BYTES,
  MEDIA_MAX_UPLOAD_MB,
  PUBLIC_MEDIA_PREFIXES,
  mediaOrderSchema,
} from '@sabor/shared';
import type { AppEnv } from '../env';
import type { MediaRow } from '../db/rows';
import { mapMedia } from '../db/rows';
import { requireAuth, requireRole } from '../middleware/auth';
import { badRequest, notFound } from '../lib/http-error';
import { parseBody } from '../lib/validate';

/**
 * Convención de claves R2: items/{item_id}/{uuid}.{ext}. La extensión viene de
 * la tabla de MIME permitidos, nunca del nombre del archivo del cliente.
 */
function buildR2Key(itemId: number, ext: string): string {
  return `${MEDIA_KEY_PREFIX}${itemId}/${crypto.randomUUID()}.${ext}`;
}

// Montado bajo /menu-items/:id/media (POST) y /media/:id (DELETE, PATCH order).

export const itemMediaRoutes = new Hono<AppEnv>();

itemMediaRoutes.post('/:id/media', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const itemId = Number(c.req.param('id'));
  const item = await c.env.DB.prepare('SELECT id FROM menu_items WHERE id = ?').bind(itemId).first();
  if (!item) throw notFound('Ítem no encontrado');

  const formData = await c.req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) throw badRequest('Se requiere un archivo en el campo "file"');

  const rule = ALLOWED_MEDIA_MIME[file.type];
  if (!rule) throw badRequest('Tipo de archivo no permitido (usar JPG, PNG, WebP, GIF, MP4 o WebM)');
  if (file.size > MEDIA_MAX_UPLOAD_BYTES) {
    throw badRequest(`El archivo supera el máximo de ${MEDIA_MAX_UPLOAD_MB} MB`);
  }

  const key = buildR2Key(itemId, rule.ext);
  await c.env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const maxOrder = await c.env.DB.prepare(
    'SELECT COALESCE(MAX(display_order), -1) + 1 as next FROM item_media WHERE item_id = ?',
  )
    .bind(itemId)
    .first<{ next: number }>();

  const result = await c.env.DB.prepare(
    'INSERT INTO item_media (item_id, type, r2_key, display_order) VALUES (?, ?, ?, ?) RETURNING *',
  )
    .bind(itemId, rule.type, key, maxOrder?.next ?? 0)
    .first<MediaRow>();
  return c.json(mapMedia(result!), 201);
});

export const mediaRoutes = new Hono<AppEnv>();

/**
 * Entrega pública de archivos guardados en R2. La clave puede tener barras
 * (items/{id}/{uuid}.ext), por eso se captura con un comodín. Sin auth: las
 * imágenes del catálogo son públicas.
 */
mediaRoutes.get('/:key{.+}', async (c) => {
  const key = c.req.param('key');
  // Solo se sirven objetos bajo los prefijos públicos (ítems y banners de
  // categoría); nunca otras claves del bucket (evita exponer todo R2 como
  // público a través de este endpoint).
  if (!PUBLIC_MEDIA_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    throw notFound('Archivo no encontrado');
  }

  const object = await c.env.MEDIA.get(key);
  if (!object) throw notFound('Archivo no encontrado');

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  // Impide que el navegador reinterprete (sniff) el contenido con otro MIME.
  headers.set('x-content-type-options', 'nosniff');
  return new Response(object.body, { headers });
});

mediaRoutes.delete('/:id', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const media = await c.env.DB.prepare('SELECT * FROM item_media WHERE id = ?').bind(id).first<MediaRow>();
  if (!media) throw notFound('Media no encontrada');

  // Se borra primero la fila D1 y luego el objeto R2: si el segundo paso falla,
  // queda un objeto huérfano (facturable pero inofensivo) en vez de una fila
  // apuntando a un archivo inexistente (imagen rota en el catálogo).
  await c.env.DB.prepare('DELETE FROM item_media WHERE id = ?').bind(id).run();
  await c.env.MEDIA.delete(media.r2_key);
  return c.body(null, 204);
});

mediaRoutes.patch('/:id/order', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const { displayOrder } = await parseBody(c, mediaOrderSchema);

  const result = await c.env.DB.prepare('UPDATE item_media SET display_order = ? WHERE id = ? RETURNING *')
    .bind(displayOrder, id)
    .first<MediaRow>();
  if (!result) throw notFound('Media no encontrada');
  return c.json(mapMedia(result));
});
