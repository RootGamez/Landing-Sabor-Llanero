/**
 * Datos del comprobante de venta (puros, sin React): convierte una `Sale` en lo
 * que pinta la tarjeta, con fechas en hora de Lima. Es un comprobante interno,
 * NO tributario (no es boleta ni factura).
 */
import { BRAND, formatPEN, tableDisplayName, ticketDetailLines, type Sale } from '@sabor/shared';
import { formatLimaLongDate, formatLimaTime, limaDay, parseUtc } from './closureFormat';

/** Leyenda del comprobante: es interno, no tributario. */
const LEGAL_NOTICE = 'Documento no válido como boleta ni factura.';

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

export type ReceiptOrigin =
  | {
      kind: 'table';
      tableLabel: string;
      openedAtLabel: string;
      paidAtLabel: string;
      /** "1 h 5 min"; `null` si las horas no cuadran. */
      stayLabel: string | null;
    }
  | { kind: 'web' }
  | { kind: 'counter' };

export interface ReceiptLine {
  id: number;
  quantity: number;
  /** "Pizza Pepperoni (Grande)". */
  title: string;
  /** Sabores / adicional / nota, con el mismo texto que el ticket térmico. */
  details: string[];
  lineTotalCents: number;
}

export interface ReceiptData {
  saleId: number;
  number: number;
  dateLabel: string;
  timeLabel: string;
  origin: ReceiptOrigin;
  lines: ReceiptLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  methodLabel: string;
  /** Solo hay efectivo recibido y vuelto en pagos en efectivo. */
  cashReceivedCents: number | null;
  changeCents: number | null;
  /**
   * Venta anulada. El motivo NO forma parte del comprobante: es una nota interna
   * del cajero y el comprobante se comparte con el cliente.
   */
  voided: boolean;
  fileName: string;
  shareText: string;
}

/** "45 min", "1 h", "1 h 5 min". `null` si el intervalo es negativo o no se puede leer. */
export function formatStay(fromUtc: string, toUtc: string): string | null {
  const from = parseUtc(fromUtc);
  const to = parseUtc(toUtc);
  if (!from || !to) return null;
  const minutes = Math.round((to.getTime() - from.getTime()) / MS_PER_MINUTE);
  if (minutes < 0) return null;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function toOrigin(sale: Sale): ReceiptOrigin {
  if (sale.table) {
    return {
      kind: 'table',
      tableLabel: sale.table.tableLabel,
      openedAtLabel: formatLimaTime(sale.table.openedAt),
      paidAtLabel: formatLimaTime(sale.createdAt),
      stayLabel: formatStay(sale.table.openedAt, sale.createdAt),
    };
  }
  return sale.orderId !== null ? { kind: 'web' } : { kind: 'counter' };
}

function toLines(sale: Sale): ReceiptLine[] {
  return sale.items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    title: item.sizeLabel ? `${item.name} (${item.sizeLabel})` : item.name,
    details: ticketDetailLines({ flavors: item.flavors, note: item.note, quantity: item.quantity }),
    lineTotalCents: item.lineTotalCents,
  }));
}

/** Etiqueta corta del origen ("Mesa 5", "Pedido web", "Mostrador"). */
export function originLabel(origin: ReceiptOrigin): string {
  if (origin.kind === 'table') {
    // La API guarda solo el rótulo: "5" -> "Mesa 5"; un nombre ("Terraza", "Mesa 2") se muestra tal cual.
    return tableDisplayName(origin.tableLabel);
  }
  return origin.kind === 'web' ? 'Pedido web' : 'Mostrador';
}

function buildShareText(data: Omit<ReceiptData, 'shareText'>): string {
  const lines = [
    `Comprobante de venta #${data.number} — ${BRAND.name}${data.voided ? ' (ANULADA)' : ''}`,
    `${data.dateLabel}, ${data.timeLabel} · ${originLabel(data.origin)}`,
    ...data.lines.map((line) => `${line.quantity}× ${line.title} — ${formatPEN(line.lineTotalCents)}`),
    `Total: ${formatPEN(data.totalCents)} (${data.methodLabel})`,
    'Gracias por tu compra.',
    LEGAL_NOTICE,
  ];
  return lines.join('\n');
}

/** `methodLabels`: etiqueta por clave de método de pago ("cash" -> "Efectivo"). */
export function toReceiptData(sale: Sale, methodLabels: ReadonlyMap<string, string>): ReceiptData {
  const hasCash = sale.cashReceivedCents !== null;
  const base: Omit<ReceiptData, 'shareText'> = {
    saleId: sale.id,
    number: sale.number,
    dateLabel: formatLimaLongDate(sale.createdAt),
    timeLabel: formatLimaTime(sale.createdAt),
    origin: toOrigin(sale),
    lines: toLines(sale),
    subtotalCents: sale.subtotalCents,
    discountCents: sale.discountCents,
    totalCents: sale.totalCents,
    methodLabel: methodLabels.get(sale.paymentMethod) ?? sale.paymentMethod,
    cashReceivedCents: sale.cashReceivedCents,
    changeCents: hasCash ? sale.changeCents : null,
    voided: sale.voidedAt !== null,
    fileName: `comprobante-venta-${sale.number}-${limaDay(sale.createdAt)}.png`,
  };
  return { ...base, shareText: buildShareText(base) };
}
