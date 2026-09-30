import { Hono } from 'hono';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  updateProfileSchema,
  type ChangePasswordResponse,
  type LoginResponse,
  type MessageResponse,
} from '@sabor/shared';
import type { AppEnv } from '../env';
import type { UserRow } from '../db/rows';
import { mapUser } from '../db/rows';
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from '../lib/password';
import { signToken } from '../lib/jwt';
import { requestPasswordReset, resetPassword, RESET_MESSAGE } from '../lib/password-reset';
import { badRequest, unauthorized } from '../lib/http-error';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import { parseBody } from '../lib/validate';

export const authRoutes = new Hono<AppEnv>();

// Rate limit por IP para frenar fuerza bruta / credential stuffing en el login.
authRoutes.post('/login', rateLimit((env) => env.LOGIN_LIMITER), async (c) => {
  const body = await parseBody(c, loginSchema);

  const row = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(body.email.toLowerCase())
    .first<UserRow>();

  // Anti-enumeración: si el email no existe, igual verificamos contra un hash
  // dummy para que el tiempo de respuesta no delate si la cuenta existe.
  const passwordHash = row?.password_hash ?? DUMMY_PASSWORD_HASH;
  const valid = await verifyPassword(body.password, passwordHash);
  if (!row || !valid) throw unauthorized('Credenciales inválidas');

  // Rastro de auditoría: el owner puede ver el último acceso de cada cuenta.
  await c.env.DB.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?")
    .bind(row.id)
    .run();

  const token = await signToken(
    { id: row.id, email: row.email, role: row.role },
    c.env.JWT_SECRET,
    row.token_version,
  );
  return c.json<LoginResponse>({ token });
});

authRoutes.get('/me', requireAuth, async (c) => {
  const authUser = c.get('user');
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(authUser.id)
    .first<UserRow>();
  if (!row) throw unauthorized();
  return c.json(mapUser(row));
});

// Perfil propio (cualquier rol): solo el nombre. Email y rol los gestiona el owner en /users.
authRoutes.patch('/me', requireAuth, async (c) => {
  const authUser = c.get('user');
  const body = await parseBody(c, updateProfileSchema);

  const row = await c.env.DB.prepare('UPDATE users SET name = ? WHERE id = ? RETURNING *')
    .bind(body.name, authUser.id)
    .first<UserRow>();
  if (!row) throw unauthorized();
  return c.json(mapUser(row));
});

/**
 * Cambio de contraseña propio. Exige la contraseña actual (un token robado no
 * alcanza para tomar la cuenta) y comparte el rate limit del login para frenar
 * fuerza bruta contra la contraseña actual. Al cambiarla se incrementa
 * token_version — todos los tokens anteriores quedan inválidos — y se devuelve
 * un token nuevo para que esta sesión siga viva.
 */
authRoutes.post(
  '/change-password',
  rateLimit((env) => env.LOGIN_LIMITER),
  requireAuth,
  async (c) => {
    const authUser = c.get('user');
    const body = await parseBody(c, changePasswordSchema);

    const row = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(authUser.id)
      .first<UserRow>();
    if (!row) throw unauthorized();

    const valid = await verifyPassword(body.currentPassword, row.password_hash);
    if (!valid) throw unauthorized('La contraseña actual es incorrecta');

    const passwordHash = await hashPassword(body.newPassword);
    const updated = await c.env.DB.prepare(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ? RETURNING *',
    )
      .bind(passwordHash, authUser.id)
      .first<UserRow>();

    const token = await signToken(
      { id: row.id, email: row.email, role: row.role },
      c.env.JWT_SECRET,
      updated!.token_version,
    );
    return c.json<ChangePasswordResponse>({ token });
  },
);

/**
 * Solicitud de recuperación de contraseña (pública). Responde SIEMPRE el
 * mismo mensaje exista o no la cuenta — mismo principio anti-enumeración que
 * `/login` (ahí vía hash dummy, aquí simplemente no delatando el resultado).
 * Comparte LOGIN_LIMITER con el login en vez de pedir un namespace propio
 * (tráfico de recuperación es mínimo, ver PLAN_IMPLEMENTACION.md).
 */
authRoutes.post('/forgot-password', rateLimit((env) => env.LOGIN_LIMITER), async (c) => {
  const body = await parseBody(c, forgotPasswordSchema);
  await requestPasswordReset(
    { env: c.env, waitUntil: (promise) => c.executionCtx.waitUntil(promise) },
    'staff',
    body.email.toLowerCase(),
  );
  return c.json<MessageResponse>({ message: RESET_MESSAGE });
});

/** Canje del token (público). La lógica atómica vive en `lib/password-reset.ts`. */
authRoutes.post('/reset-password', rateLimit((env) => env.LOGIN_LIMITER), async (c) => {
  const body = await parseBody(c, resetPasswordSchema);

  // Genérico a propósito: inválido, vencido y ya usado dan el mismo 400, sin
  // distinguir motivo (no darle a un atacante información sobre el token).
  if (!(await resetPassword(c.env, 'staff', body.token, body.newPassword))) {
    throw badRequest('El link de recuperación es inválido o venció');
  }
  return c.json<MessageResponse>({ message: 'Contraseña actualizada' });
});
