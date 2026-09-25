import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv, AuthCustomer } from '../env';
import type { CustomerRow } from '../db/rows';
import { verifyCustomerToken } from '../lib/jwt';
import { unauthorized } from '../lib/http-error';

/**
 * Verifica el Bearer token de cliente y devuelve el cliente, o lanza 401.
 * Mismo patrón que `authenticate` (middleware/auth.ts) pero contra
 * `customers`/`CUSTOMER_JWT_SECRET` — namespace de auth completamente
 * separado del de staff (ver "Seguridad: JWT de cliente separado").
 */
export async function authenticateCustomer(c: Context<AppEnv>): Promise<AuthCustomer> {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  const token = header.slice('Bearer '.length);
  let payload;
  try {
    payload = await verifyCustomerToken(token, c.env.CUSTOMER_JWT_SECRET);
  } catch {
    throw unauthorized('Token inválido o expirado');
  }

  // Revalidación contra la DB, igual que `authenticate`: un cliente borrado o
  // con la contraseña cambiada deja de ser válido al instante.
  const row = await c.env.DB.prepare('SELECT id, email, token_version FROM customers WHERE id = ?')
    .bind(payload.customerId)
    .first<Pick<CustomerRow, 'id' | 'email' | 'token_version'>>();
  if (!row) throw unauthorized('La sesión ya no es válida');
  if ((payload.tokenVersion ?? 0) !== row.token_version) {
    throw unauthorized('La sesión ya no es válida');
  }
  return { id: row.id, email: row.email };
}

/** Exige un JWT de cliente válido y lo adjunta en c.var.customer */
export const requireCustomerAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('customer', await authenticateCustomer(c));
  await next();
};
