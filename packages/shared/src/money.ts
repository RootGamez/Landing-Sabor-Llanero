/**
 * Dinero del back-office (Plan Parte 3, D1): céntimos `INTEGER` en todas las
 * tablas nuevas (`*_cents`). Las tablas viejas guardan soles como `REAL`; el
 * único puente permitido entre ambos mundos es este módulo, para que el
 * redondeo de floats viva en un solo lugar.
 */
import { formatPrice } from './format';

/** Tope sanitario por monto: S/ 999 999,99. Evita desbordes y typos de teclado en el POS. */
export const MAX_CENTS = 99_999_999;

/** Dígitos significativos que se conservan al limpiar el ruido binario de un float. */
const FLOAT_NOISE_PRECISION = 12;

/**
 * Soles (float) → céntimos enteros. Robusto a ruido binario: `0.1 + 0.2` da
 * 30 y `1.005` da 101 (el `Math.round(x * 100)` ingenuo da 100). Rechaza
 * negativos y no finitos: ningún monto de venta/gasto es negativo, y un NaN
 * silencioso en un total de caja es peor que un error explícito.
 */
export function toCents(soles: number): number {
  if (!Number.isFinite(soles) || soles < 0) {
    throw new RangeError(`monto inválido: ${soles}`);
  }
  const cents = Math.round(Number((soles * 100).toPrecision(FLOAT_NOISE_PRECISION)));
  if (cents > MAX_CENTS) {
    throw new RangeError(`monto excede el máximo permitido: ${soles}`);
  }
  return cents;
}

/**
 * Céntimos enteros → soles (float, solo para mostrar o hablar con tablas
 * `REAL`). Acepta negativos a propósito: la diferencia de caja
 * (contado − esperado) puede ser faltante.
 */
export function fromCents(cents: number): number {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`céntimos debe ser un entero: ${cents}`);
  }
  return cents / 100;
}

/** Céntimos → texto de moneda ("S/ 1,234.50"), reutilizando el formateador único de `format.ts`. */
export function formatPEN(cents: number): string {
  return formatPrice(fromCents(cents));
}
