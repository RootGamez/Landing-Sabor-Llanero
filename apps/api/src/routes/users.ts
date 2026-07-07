import { Hono } from 'hono';
import { createUserSchema, updateUserSchema } from '@sabor/shared';
import type { AppEnv } from '../env';
import type { UserRow } from '../db/rows';
import { mapUser } from '../db/rows';
import { requireAuth, requireRole } from '../middleware/auth';
import { hashPassword } from '../lib/password';
import { conflict, forbidden, notFound } from '../lib/http-error';
import { parseBody } from '../lib/validate';

// Toda esta sección es solo-owner (BLUEPRINT §1.6: el owner administra usuarios).
export const userRoutes = new Hono<AppEnv>();
userRoutes.use('*', requireAuth, requireRole('owner'));

userRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM users ORDER BY created_at ASC').all<
    UserRow
  >();
  return c.json(results.map(mapUser));
});

userRoutes.post('/', async (c) => {
  const body = await parseBody(c, createUserSchema);

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(body.email.toLowerCase())
    .first();
  if (existing) throw conflict('Ya existe un usuario con ese email');

  const passwordHash = await hashPassword(body.password);
  const result = await c.env.DB.prepare(
    'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?) RETURNING *',
  )
    .bind(body.email.toLowerCase(), passwordHash, body.name, body.role)
    .first<UserRow>();
  return c.json(mapUser(result!), 201);
});

/** true si el usuario dado es el único owner que queda (no se puede degradar ni eliminar). */
async function isLastOwner(db: D1Database, user: UserRow): Promise<boolean> {
  if (user.role !== 'owner') return false;
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'owner'")
    .first<{ count: number }>();
  return (row?.count ?? 0) <= 1;
}

userRoutes.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await parseBody(c, updateUserSchema);

  const current = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<UserRow>();
  if (!current) throw notFound('Usuario no encontrado');

  // Degradar al último owner dejaría el panel sin nadie que administre usuarios.
  const isDemotion = body.role === 'admin' && current.role === 'owner';
  if (isDemotion && (await isLastOwner(c.env.DB, current))) {
    throw forbidden('No podés degradar al último owner');
  }

  const passwordHash = body.password ? await hashPassword(body.password) : current.password_hash;
  // Cambiar la contraseña (o degradar el rol) invalida las sesiones abiertas
  // del usuario: token_version + 1 mata cualquier JWT emitido antes.
  const bumpTokenVersion = Boolean(body.password) || isDemotion;
  const updated = await c.env.DB.prepare(
    'UPDATE users SET name = ?, role = ?, password_hash = ?, token_version = token_version + ? WHERE id = ? RETURNING *',
  )
    .bind(
      body.name ?? current.name,
      body.role ?? current.role,
      passwordHash,
      bumpTokenVersion ? 1 : 0,
      id,
    )
    .first<UserRow>();
  return c.json(mapUser(updated!));
});

userRoutes.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const actingUser = c.get('user');
  if (actingUser.id === id) throw forbidden('No podés eliminar tu propio usuario');

  const result = await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  if (result.meta.changes === 0) throw notFound('Usuario no encontrado');
  return c.body(null, 204);
});
