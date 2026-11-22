import {
  BRAND,
  formatPEN,
  hasExpectedCash,
  isReconciledSnapshot,
  type BackofficeSource,
  type CashSessionDetail,
  type CashSessionTotals,
} from '@sabor/shared';
import { describeDifference } from './cashCount';
import { averageTicketCents, formatLimaLongDate, formatShiftRange, limaDay } from './closureFormat';

/**
 * Lo que necesita la tarjeta/resumen de un cierre. Sale del snapshot congelado;
 * las sesiones importadas (Aronium/HomeBank) pueden no tener conteo de efectivo.
 * `reconciled: false` = caja cerrada sin cuadrar (D15): sin esperado, contado ni diferencia.
 */
export interface ClosureData extends CashSessionTotals {
  closedAt: string | null;
  reconciled: boolean;
  expectedCashCents: number | null;
  countedCashCents: number | null;
  differenceCents: number | null;
  source: BackofficeSource;
}

const NOT_RECONCILED = { reconciled: false, expectedCashCents: null, countedCashCents: null, differenceCents: null } as const;

export function toClosureData(detail: CashSessionDetail): ClosureData {
  const snapshot = detail.closeSnapshot;
  if (snapshot && !isReconciledSnapshot(snapshot)) return { ...snapshot, ...NOT_RECONCILED, source: detail.source };
  if (snapshot) return { ...snapshot, reconciled: true, source: detail.source };
  const counted = detail.countedCashCents;
  const expected = hasExpectedCash(detail.summary) ? detail.summary.expectedCashCents : null;
  return {
    ...detail.summary,
    closedAt: detail.closedAt,
    reconciled: true,
    expectedCashCents: expected,
    countedCashCents: counted,
    differenceCents: counted === null || expected === null ? null : counted - expected,
    source: detail.source,
  };
}

export function closureFileName(data: ClosureData): string {
  return `cierre-caja-${limaDay(data.closedAt ?? data.openedAt)}.png`;
}

/** Texto del cierre para pegar en WhatsApp (negritas con `*`). */
export function buildClosureText(data: ClosureData): string {
  const day = formatLimaLongDate(data.closedAt ?? data.openedAt);
  const lines = [
    `*Cierre de caja — ${BRAND.name}*`,
    `${day} · Turno ${formatShiftRange(data.openedAt, data.closedAt)}`,
    '',
    `*Total vendido: ${formatPEN(data.totalSalesCents)}*`,
    `${data.salesCount} ventas · Ticket promedio ${formatPEN(averageTicketCents(data))}`,
  ];
  if (data.byMethod.length > 0) {
    lines.push('', '*Por método de pago*');
    data.byMethod.forEach((m) => lines.push(`• ${m.label}: ${formatPEN(m.totalCents)} (${m.salesCount})`));
  }
  const top = data.topProducts.slice(0, 5);
  if (top.length > 0) {
    lines.push('', '*Más vendidos*');
    top.forEach((p) => lines.push(`• ${p.quantity}× ${p.name} — ${formatPEN(p.totalCents)}`));
  }
  lines.push('', '*Caja*', `Gastos de caja: ${formatPEN(data.cashExpensesCents)}`);
  if (!data.reconciled) lines.push('Caja no cuadrada');
  if (data.reconciled && data.expectedCashCents !== null) lines.push(`Efectivo esperado: ${formatPEN(data.expectedCashCents)}`);
  if (data.countedCashCents !== null && data.differenceCents !== null) {
    const diff = describeDifference(data.differenceCents);
    lines.push(`Efectivo contado: ${formatPEN(data.countedCashCents)}`);
    lines.push(`Diferencia: ${diff.label}${diff.absCents > 0 ? ` ${formatPEN(diff.absCents)}` : ''}`);
  }
  lines.push(`Ventas anuladas: ${data.voidedCount}`);
  return lines.join('\n');
}
