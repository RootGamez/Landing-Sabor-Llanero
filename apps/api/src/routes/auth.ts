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
import type { SendEmail } from '../env';
import type { UserRow } from '../db/rows';
import { mapUser } from '../db/rows';
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from '../lib/password';
import { signToken } from '../lib/jwt';
import { generateResetToken, hashResetToken } from '../lib/reset-token';
import { badRequest, unauthorized } from '../lib/http-error';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import { parseBody } from '../lib/validate';

const RESET_TOKEN_TTL_MINUTES = 30;
const RESET_MESSAGE = 'Si el email existe, vas a recibir un link para recuperar tu contraseña.';

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
 * `/login` (ahí vía hash dummy, acá simplemente no delatando el resultado).
 * Comparte LOGIN_LIMITER con el login en vez de pedir un namespace propio
 * (tráfico de recuperación es mínimo, ver PLAN_IMPLEMENTACION.md).
 */
authRoutes.post('/forgot-password', rateLimit((env) => env.LOGIN_LIMITER), async (c) => {
  const body = await parseBody(c, forgotPasswordSchema);
  const email = body.email.toLowerCase();

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: number }>();

  // Estas dos DELETE corren siempre, exista o no la cuenta (con id -1 la
  // primera no borra nada si no hay usuario): mismo costo de DB en ambas
  // ramas para no delatar por timing si el email existe. Solo el INSERT de
  // abajo queda condicional (no tiene sentido emitir un token para nadie) —
  // ese residuo de señal se acepta acá por ser un panel solo-staff con un
  // puñado de emails conocidos y el mismo rate limit que /login.
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').bind(user?.id ?? -1),
    c.env.DB.prepare("DELETE FROM password_reset_tokens WHERE expires_at <= datetime('now')"),
  ]);

  if (user) {
    const token = generateResetToken();
    const tokenHash = await hashResetToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000).toISOString();

    await c.env.DB.prepare(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    )
      .bind(user.id, tokenHash, expiresAt)
      .run();

    if (c.env.EMAIL) {
      c.executionCtx.waitUntil(sendResetEmail(c.env.EMAIL, email, token, c.env.CMS_ORIGIN));
    }
  }

  return c.json<MessageResponse>({ message: RESET_MESSAGE });
});

/**
 * Canje del token (público). El guard de "válido, no usado, no vencido" vive
 * dentro del UPDATE (WHERE), no como un SELECT previo: mismo idiom atómico
 * que el guard de "último owner" en routes/users.ts — evita una ventana
 * TOCTOU entre leer el token y marcarlo usado.
 */
authRoutes.post('/reset-password', rateLimit((env) => env.LOGIN_LIMITER), async (c) => {
  const body = await parseBody(c, resetPasswordSchema);
  const tokenHash = await hashResetToken(body.token);

  const claimed = await c.env.DB.prepare(
    `UPDATE password_reset_tokens SET used_at = datetime('now')
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')
     RETURNING user_id`,
  )
    .bind(tokenHash)
    .first<{ user_id: number }>();

  // Genérico a propósito: inválido, vencido y ya usado dan el mismo 400, sin
  // distinguir motivo (no darle a un atacante información sobre el token).
  if (!claimed) throw badRequest('El link de recuperación es inválido o venció');

  const passwordHash = await hashPassword(body.newPassword);
  await c.env.DB.prepare(
    'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
  )
    .bind(passwordHash, claimed.user_id)
    .run();

  return c.json<MessageResponse>({ message: 'Contraseña actualizada' });
});

async function sendResetEmail(
  emailBinding: SendEmail,
  to: string,
  token: string,
  cmsOrigin: string | undefined,
): Promise<void> {
  // CMS_ORIGIN solo está seteado en producción (ver "Decisiones de
  // integración" en PLAN_IMPLEMENTACION.md); en dev local no hay dominio real.
  const baseUrl = cmsOrigin?.split(',')[0] ?? 'http://localhost:5174';
  // Fragment (#), no query string: el token nunca viaja al servidor ni queda
  // expuesto en un header Referer si la página carga algún recurso externo.
  const link = `${baseUrl}/reset-password#token=${encodeURIComponent(token)}`;

  await emailBinding.send({
    to,
    from: { email: 'no-responder@saborllanero.online', name: 'Sabor Llanero' },
    subject: 'Recuperar tu contraseña',
    html: `<p>Pediste recuperar tu contraseña. Este link vence en ${RESET_TOKEN_TTL_MINUTES} minutos:</p><p><a href="${link}">${link}</a></p><p>Si no fuiste vos, ignorá este email.</p>`,
    text: `Pediste recuperar tu contraseña. Este link vence en ${RESET_TOKEN_TTL_MINUTES} minutos: ${link}\n\nSi no fuiste vos, ignorá este email.`,
  });
}
