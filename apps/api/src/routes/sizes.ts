import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import type { SizeRow } from '../db/rows';
import { mapSize } from '../db/rows';
import { requireAuth, requireRole } from '../middleware/auth';
import { notFound } from '../lib/http-error';
import { parseBody } from '../lib/validate';
import { requireIdParam } from '../lib/params';

export const sizeRoutes = new Hono<AppEnv>();

// Público: la lista de tamaños del negocio, en orden de exhibición.
sizeRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM sizes ORDER BY display_order ASC').all<
    SizeRow
  >();
  return c.json(results.map(mapSize));
});

/**
 * Edición de labels/detalle bilingües de un tamaño (ej. corregir "6 porciones"
 * a "8 porciones"). No hay alta/baja por ahora (BLUEPRINT §4.1: los tamaños
 * son un catálogo fijo del negocio; agregar uno nuevo es una migración).
 */
const updateSizeSchema = z.object({
  labelEs: z.string().min(1).optional(),
  labelEn: z.string().optional(),
  detailEs: z.string().optional(),
  detailEn: z.string().optional(),
});

sizeRoutes.patch('/:id', requireAuth, requireRole('owner', 'admin'), async (c) => {
  const id = requireIdParam(c);
  const body = await parseBody(c, updateSizeSchema);

  const current = await c.env.DB.prepare('SELECT * FROM sizes WHERE id = ?')
    .bind(id)
    .first<SizeRow>();
  if (!current) throw notFound('Tamaño no encontrado');

  const updated = await c.env.DB.prepare(
    'UPDATE sizes SET label_es = ?, label_en = ?, detail_es = ?, detail_en = ? WHERE id = ? RETURNING *',
  )
    .bind(
      body.labelEs ?? current.label_es,
      body.labelEn ?? current.label_en,
      body.detailEs ?? current.detail_es,
      body.detailEn ?? current.detail_en,
      id,
    )
    .first<SizeRow>();
  return c.json(mapSize(updated!));
});
