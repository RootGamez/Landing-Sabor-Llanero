/**
 * Recuperación de contraseña, compartida entre staff (`users`) y clientes
 * (`customers`). Cada audiencia tiene su propia tabla de tokens — los dos
 * mundos de auth nunca comparten tablas — pero el flujo es idéntico, así que
 * la lógica vive una sola vez aquí y las rutas solo eligen la audiencia.
 */
import type { Bindings } from '../env';
import { hashPassword } from './password';
import { sendEmailSafely } from './mailer';
import { generateResetToken, hashResetToken } from './reset-token';

export type ResetAudience = 'staff' | 'customer';

export type ResetEnv = Pick<
  Bindings,
  'DB' | 'MAIL_LAMBDA_URL' | 'MAIL_LAMBDA_SECRET' | 'WEB_ORIGIN' | 'CMS_ORIGIN'
>;

export const RESET_TOKEN_TTL_MINUTES = 30;
/** Mismo mensaje exista o no la cuenta (anti-enumeración), para ambas audiencias. */
export const RESET_MESSAGE = 'Si el email existe, vas a recibir un link para recuperar tu contraseña.';
/**
 * Mínimo entre dos emails de recuperación para la misma cuenta. Frena que el
 * endpoint público sirva para llenar de emails el buzón de otra persona (el
 * rate limit por IP solo no alcanza contra atacantes distribuidos).
 */
export const RESET_REQUEST_COOLDOWN_SECONDS = 60;
/**
 * Tope de links vigentes por cuenta. Junto con el cooldown acota los emails a
 * ~5 por cada 30 min por cuenta, y evita que un tercero invalide el link que
 * la víctima está por usar (los pedidos nuevos NO borran los tokens vigentes).
 */
export const MAX_LIVE_RESET_TOKENS = 5;

interface ResetTarget {
  accountsTable: string;
  tokensTable: string;
  accountIdColumn: string;
  /** Origen donde vive la pantalla de "nueva contraseña" (primero de la lista configurada). */
  linkBase: (env: ResetEnv) => string;
  linkPath: string;
}

function firstOrigin(configured: string | undefined, fallback: string): string {
  return configured?.split(',')[0]?.trim() || fallback;
}

// Los nombres de tabla/columna salen de esta constante, nunca de input del
// usuario: es lo único que se interpola en el SQL de abajo.
const TARGETS: Record<ResetAudience, ResetTarget> = {
  staff: {
    accountsTable: 'users',
    tokensTable: 'password_reset_tokens',
    accountIdColumn: 'user_id',
    // En dev local no hay dominio real (CMS_ORIGIN solo está seteado en producción).
    linkBase: (env) => firstOrigin(env.CMS_ORIGIN, 'http://localhost:5174'),
    linkPath: '/reset-password',
  },
  customer: {
    accountsTable: 'customers',
    tokensTable: 'customer_password_reset_tokens',
    accountIdColumn: 'customer_id',
    // OJO: el primer origen de WEB_ORIGIN debe estar también en ALLOWED_LINK_ORIGINS de la Lambda.
    linkBase: (env) => firstOrigin(env.WEB_ORIGIN, 'http://localhost:3000'),
    linkPath: '/cuenta/restablecer/',
  },
};

/**
 * Emite un token de recuperación y despacha el email en background. No
 * devuelve nada a propósito: la ruta responde siempre `RESET_MESSAGE`.
 *
 * La decisión "¿corresponde emitir?" (cuenta existe, fuera del cooldown, bajo
 * el tope de tokens vigentes) vive dentro del propio INSERT y corre en un
 * `batch` (una transacción): dos pedidos simultáneos no pueden pasar ambos el
 * cooldown. El email solo sale si el INSERT realmente insertó una fila.
 * Para una cuenta inexistente se ejecutan las mismas operaciones (id -1: el
 * INSERT no inserta nada), así no se delata por timing si el email existe.
 */
export async function requestPasswordReset(
  ctx: { env: ResetEnv; waitUntil: (promise: Promise<unknown>) => void },
  audience: ResetAudience,
  email: string,
): Promise<void> {
  const { env } = ctx;
  const target = TARGETS[audience];
  const { accountsTable, tokensTable, accountIdColumn } = target;

  const account = await env.DB.prepare(`SELECT id FROM ${accountsTable} WHERE email = ?`)
    .bind(email)
    .first<{ id: number }>();
  const accountId = account?.id ?? -1;

  const token = generateResetToken();
  const tokenHash = await hashResetToken(token);

  // El vencimiento se calcula con el propio datetime() de SQLite, no con
  // `new Date().toISOString()`: ese formato ("...T...Z") compara como texto
  // MAYOR que el de `datetime('now')` ("YYYY-MM-DD HH:MM:SS") para cualquier
  // hora del mismo día (la 'T' > ' ' en ASCII), así que el guard de
  // `expires_at > datetime('now')` nunca daba por vencido un token creado el
  // mismo día.
  const [, insert] = await env.DB.batch([
    env.DB.prepare(`DELETE FROM ${tokensTable} WHERE expires_at <= datetime('now')`),
    env.DB.prepare(
      `INSERT INTO ${tokensTable} (${accountIdColumn}, token_hash, expires_at)
       SELECT ?, ?, datetime('now', ?)
       WHERE EXISTS (SELECT 1 FROM ${accountsTable} WHERE id = ?)
         AND NOT EXISTS (
           SELECT 1 FROM ${tokensTable}
           WHERE ${accountIdColumn} = ? AND created_at > datetime('now', ?)
         )
         AND (
           SELECT COUNT(*) FROM ${tokensTable}
           WHERE ${accountIdColumn} = ? AND used_at IS NULL AND expires_at > datetime('now')
         ) < ?`,
    ).bind(
      accountId,
      tokenHash,
      `+${RESET_TOKEN_TTL_MINUTES} minutes`,
      accountId,
      accountId,
      `-${RESET_REQUEST_COOLDOWN_SECONDS} seconds`,
      accountId,
      MAX_LIVE_RESET_TOKENS,
    ),
  ]);
  if (insert?.meta.changes !== 1) return;

  // Fragment (#), no query string: el token nunca viaja al servidor ni queda
  // expuesto en un header Referer si la página carga algún recurso externo.
  const link = `${target.linkBase(env)}${target.linkPath}#token=${encodeURIComponent(token)}`;
  ctx.waitUntil(
    sendEmailSafely(env, 'password-reset', email, { link, expiresMinutes: RESET_TOKEN_TTL_MINUTES }),
  );
}

/**
 * Canjea el token y cambia la contraseña. Devuelve `false` si el token es
 * inválido, vencido o ya usado (sin distinguir el motivo).
 *
 * Cambiar la contraseña e invalidar los tokens de la cuenta ocurre en un solo
 * `batch` (transacción): si algo falla a mitad de camino no queda un token
 * gastado con la contraseña sin cambiar. El guard "válido, no usado, no
 * vencido" vive dentro de los propios UPDATE (subconsulta), no en un SELECT
 * previo, así que dos canjes simultáneos no pueden ganar los dos. Subir
 * `token_version` invalida todas las sesiones anteriores; marcar como usados
 * los demás tokens vigentes de la cuenta evita que un link viejo siga sirviendo.
 */
export async function resetPassword(
  env: Pick<Bindings, 'DB'>,
  audience: ResetAudience,
  token: string,
  newPassword: string,
): Promise<boolean> {
  const { accountsTable, tokensTable, accountIdColumn } = TARGETS[audience];
  const tokenHash = await hashResetToken(token);
  const liveToken = `token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`;

  // Chequeo barato solo para no gastar el hash de la contraseña con un token
  // basura; la decisión real la toma el batch de abajo.
  const exists = await env.DB.prepare(`SELECT 1 AS found FROM ${tokensTable} WHERE ${liveToken}`)
    .bind(tokenHash)
    .first();
  if (!exists) return false;

  const passwordHash = await hashPassword(newPassword);
  const [updated] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE ${accountsTable} SET password_hash = ?, token_version = token_version + 1
       WHERE id = (SELECT ${accountIdColumn} FROM ${tokensTable} WHERE ${liveToken})`,
    ).bind(passwordHash, tokenHash),
    env.DB.prepare(
      `UPDATE ${tokensTable} SET used_at = datetime('now')
       WHERE used_at IS NULL
         AND ${accountIdColumn} = (SELECT ${accountIdColumn} FROM ${tokensTable} WHERE ${liveToken})`,
    ).bind(tokenHash),
  ]);
  return updated?.meta.changes === 1;
}
