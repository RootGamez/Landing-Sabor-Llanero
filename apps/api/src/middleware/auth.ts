import type { Context, MiddlewareHandler } from 'hono';
import type { Role } from '@sabor/shared';
import type { AppEnv, AuthUser } from '../env';
import type { UserRow } from '../db/rows';
import { verifyToken, type JwtPayload } from '../lib/jwt';
import { forbidden, unauthorized } from '../lib/http-error';

/**
 * Verifica el Bearer token y devuelve el usuario, o lanza 401.
 * Reutilizable fuera de la cadena de middleware (p. ej. rutas que son
 * públicas por slug pero autenticadas por id).
 */
export async function authenticate(c: Context<AppEnv>): Promise<AuthUser> {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  const token = header.slice('Bearer '.length);
  let payload: JwtPayload;
  try {
    payload = await verifyToken(token, c.env.JWT_SECRET);
  } catch {
    throw unauthorized('Token inválido o expirado');
  }

  // Revalidación contra la DB: un usuario borrado o con el rol cambiado deja de
  // ser válido al instante, sin esperar a que expire el token. El rol se toma de
  // la fila (fuente de verdad), no del payload, para no confiar en un token viejo.
  const row = await c.env.DB.prepare('SELECT id, email, role, token_version FROM users WHERE id = ?')
    .bind(payload.id)
    .first<Pick<UserRow, 'id' | 'email' | 'role' | 'token_version'>>();
  if (!row) throw unauthorized('La sesión ya no es válida');
  // Cambio de contraseña incrementa token_version: los tokens firmados antes
  // quedan inválidos. Tokens previos a esta versión no traen el campo → 0.
  if ((payload.tokenVersion ?? 0) !== row.token_version) {
    throw unauthorized('La sesión ya no es válida');
  }
  return { id: row.id, email: row.email, role: row.role };
}

/** Exige un JWT válido y adjunta el usuario en c.var.user */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('user', await authenticate(c));
  await next();
};

/** Exige que el usuario autenticado tenga uno de los roles permitidos. Usar después de requireAuth. */
export function requireRole(...roles: Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('user');
    if (!roles.includes(user.role)) throw forbidden();
    await next();
  };
}
