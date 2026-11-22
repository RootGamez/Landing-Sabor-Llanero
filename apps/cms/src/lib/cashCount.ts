/**
 * Arqueo de efectivo (PEN): denominaciones, suma y lectura de la diferencia.
 * Todo en céntimos enteros (D1) y sin mutar argumentos.
 */
import { MAX_CENTS } from '@sabor/shared';

export interface Denomination {
  cents: number;
  label: string;
  kind: 'bill' | 'coin';
}

export const DENOMINATIONS: readonly Denomination[] = [
  { cents: 20_000, label: 'S/ 200', kind: 'bill' },
  { cents: 10_000, label: 'S/ 100', kind: 'bill' },
  { cents: 5_000, label: 'S/ 50', kind: 'bill' },
  { cents: 2_000, label: 'S/ 20', kind: 'bill' },
  { cents: 1_000, label: 'S/ 10', kind: 'bill' },
  { cents: 500, label: 'S/ 5', kind: 'coin' },
  { cents: 200, label: 'S/ 2', kind: 'coin' },
  { cents: 100, label: 'S/ 1', kind: 'coin' },
  { cents: 50, label: 'S/ 0.50', kind: 'coin' },
  { cents: 20, label: 'S/ 0.20', kind: 'coin' },
  { cents: 10, label: 'S/ 0.10', kind: 'coin' },
];

export const MAX_UNITS_PER_DENOMINATION = 9_999;

/** Cantidad de billetes/monedas por denominación (clave = céntimos). */
export type CashCounts = Readonly<Record<number, number>>;

export const EMPTY_COUNTS: CashCounts = {};

/** Valor en céntimos del conteo; `null` si supera el tope permitido por monto. */
export function sumCounts(counts: CashCounts): number | null {
  const total = DENOMINATIONS.reduce((sum, d) => sum + d.cents * (counts[d.cents] ?? 0), 0);
  return total <= MAX_CENTS ? total : null;
}

/** Devuelve un conteo nuevo con la cantidad de `cents` acotada a `[0, MAX_UNITS_PER_DENOMINATION]`. */
export function withCount(counts: CashCounts, cents: number, quantity: number): CashCounts {
  const clamped = Math.min(Math.max(Math.trunc(quantity) || 0, 0), MAX_UNITS_PER_DENOMINATION);
  return { ...counts, [cents]: clamped };
}

export type DifferenceKind = 'even' | 'over' | 'short';

export interface DifferenceInfo {
  kind: DifferenceKind;
  /** Texto corto que acompaña siempre al color (nunca solo color). */
  label: string;
  absCents: number;
}

/** contado − esperado: positivo = sobrante, negativo = faltante. */
export function describeDifference(differenceCents: number): DifferenceInfo {
  if (differenceCents === 0) return { kind: 'even', label: 'Cuadra', absCents: 0 };
  return differenceCents > 0
    ? { kind: 'over', label: 'Sobrante', absCents: differenceCents }
    : { kind: 'short', label: 'Faltante', absCents: -differenceCents };
}
