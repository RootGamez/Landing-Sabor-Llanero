import { BRAND, formatPEN, type BackofficeSource, type CashSessionDetail, type CashSessionSummary } from '@sabor/shared';
import { describeDifference } from './cashCount';
import { averageTicketCents, formatLimaLongDate, formatShiftRange, limaDay } from './closureFormat';

/**
 * Lo que necesita la tarjeta/resumen de un cierre. Sale del snapshot congelado;
 * las sesiones importadas (Aronium/HomeBank) pueden no tener conteo de efectivo.
 */
export interface ClosureData extends CashSessionSummary {
  closedAt: string | null;
  countedCashCents: number | null;
  differenceCents: number | null;
  source: BackofficeSource;
}

export function toClosureData(detail: CashSessionDetail): ClosureData {
  const snapshot = detail.closeSnapshot;
  if (snapshot) return { ...snapshot, source: detail.source };
  const counted = detail.countedCashCents;
  return {
    ...detail.summary,
    closedAt: detail.closedAt,
    countedCashCents: counted,
    differenceCents: counted === null ? null : counted - detail.summary.expectedCashCents,
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
  lines.push(`Efectivo esperado: ${formatPEN(data.expectedCashCents)}`);
  if (data.countedCashCents !== null && data.differenceCents !== null) {
    const diff = describeDifference(data.differenceCents);
    lines.push(`Efectivo contado: ${formatPEN(data.countedCashCents)}`);
    lines.push(`Diferencia: ${diff.label}${diff.absCents > 0 ? ` ${formatPEN(diff.absCents)}` : ''}`);
  }
  lines.push(`Ventas anuladas: ${data.voidedCount}`);
  return lines.join('\n');
}
