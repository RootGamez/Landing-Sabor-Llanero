/**
 * Identificador corto de pedido (ej. "A1B2C3") para referenciarlo en WhatsApp
 * y en la card del CMS. Alfabeto sin caracteres ambiguos (0/O, 1/I/L). No hay
 * retry en colisión: con este alfabeto (32^6 ≈ 10^9 combinaciones) y el
 * volumen de una sola pizzería, la probabilidad es despreciable — si llegara
 * a chocar, el UNIQUE(code) de la tabla lo convierte en 409 (mismo backstop
 * que ya usa el repo para el email de `users`/`customers`).
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateOrderCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}
