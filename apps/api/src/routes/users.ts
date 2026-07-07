import { Hono } from 'hono';
import { createUserSchema, updateUserSchema } from '@sabor/shared';
import type { AppEnv } from '../env';
import type { UserRow } from '../db/rows';
import { mapUser } from '../db/rows';
import { requireAuth, requireRole } from '../middleware/auth';
import { hashPassword } from '../lib/password';
import { conflict, forbidden, notFound } from '../lib/http-error';
import { parseBody } from '../lib/validate';
import { requireIdParam } from '../lib/params';

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

userRoutes.patch('/:id', async (c) => {
  const id = requireIdParam(c);
  const body = await parseBody(c, updateUserSchema);

  const current = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<UserRow>();
  if (!current) throw notFound('Usuario no encontrado');

  const newRole = body.role ?? current.role;
  const passwordHash = body.password ? await hashPassword(body.password) : current.password_hash;
  // Cambiar la contraseña (o degradar el rol) invalida las sesiones abiertas
  // del usuario: token_version + 1 mata cualquier JWT emitido antes.
  const isDemotion = newRole !== current.role && current.role === 'owner';
  const bumpTokenVersion = Boolean(body.password) || isDemotion;

  // El guard de "no degradar al último owner" vive DENTRO del UPDATE (WHERE),
  // no como un SELECT COUNT previo: así el chequeo y la escritura son atómicos
  // y dos PATCH concurrentes no pueden dejar 0 owners (check-then-act, TOCTOU).
  const updated = await c.env.DB.prepare(
    `UPDATE users SET name = ?, role = ?, password_hash = ?, token_version = token_version + ?
     WHERE id = ?
       AND (role != 'owner' OR ? = 'owner' OR (SELECT COUNT(*) FROM users WHERE role = 'owner') > 1)
     RETURNING *`,
  )
    .bind(
      body.name ?? current.name,
      newRole,
      passwordHash,
      bumpTokenVersion ? 1 : 0,
      id,
      newRole,
    )
    .first<UserRow>();

  // El id existe (se confirmó arriba): si no hay fila devuelta, el WHERE lo
  // bloqueó por ser el último owner, no porque el usuario no exista.
  if (!updated) throw conflict('No se puede degradar al último owner');

  return c.json(mapUser(updated));
});

userRoutes.delete('/:id', async (c) => {
  const id = requireIdParam(c);
  const actingUser = c.get('user');
  if (actingUser.id === id) throw forbidden('No podés eliminar tu propio usuario');

  // Mismo patrón atómico que el PATCH: el guard de "último owner" va en el
  // propio WHERE del DELETE para no dejar una ventana TOCTOU entre el check y
  // el borrado (dos owners eliminándose mutuamente en paralelo).
  const result = await c.env.DB.prepare(
    `DELETE FROM users WHERE id = ?
       AND (role != 'owner' OR (SELECT COUNT(*) FROM users WHERE role = 'owner') > 1)`,
  )
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    const exists = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
    if (!exists) throw notFound('Usuario no encontrado');
    throw conflict('No se puede eliminar al último owner');
  }
  return c.body(null, 204);
});
