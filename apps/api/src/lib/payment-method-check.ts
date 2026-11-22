import { badRequest } from './http-error';

/** Falla con 400 si el método de pago no existe o está desactivado. */
export async function assertPaymentMethodActive(db: D1Database, key: string): Promise<void> {
  const row = await db
    .prepare('SELECT key FROM payment_methods WHERE key = ? AND is_active = 1')
    .bind(key)
    .first();
  if (!row) throw badRequest('Método de pago inválido o inactivo');
}
