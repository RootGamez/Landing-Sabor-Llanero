import type { CashCloseSnapshot, CashSessionSummary } from '@sabor/shared';

/**
 * Foto del cierre (D15). Con conteo (`countedCashCents` numérico) lleva
 * esperado, contado y diferencia; sin conteo es un cierre sin cuadrar:
 * `reconciled: false` y NADA del efectivo esperado/contado/diferencia, solo los
 * totales de ventas, métodos, top, gastos de caja y anuladas.
 */
export function buildCloseSnapshot(
  summary: CashSessionSummary,
  closedAt: string,
  countedCashCents: number | null,
): CashCloseSnapshot {
  const { expectedCashCents, ...totals } = summary;
  if (countedCashCents === null) return { ...totals, reconciled: false, closedAt };
  return {
    ...totals,
    reconciled: true,
    expectedCashCents,
    closedAt,
    countedCashCents,
    differenceCents: countedCashCents - expectedCashCents,
  };
}

/** Esperado que se guarda en `cash_sessions.expected_cash_cents`: NULL si la caja no se cuadró. */
export function expectedForSnapshot(snapshot: CashCloseSnapshot): number | null {
  return snapshot.reconciled === false ? null : snapshot.expectedCashCents;
}
