/** Fechas y cifras del cierre de caja, siempre en hora de Lima (D2), sin importar la zona del navegador. */
import { localDate, type CashSessionSummary } from '@sabor/shared';

const LIMA_TZ = 'America/Lima';

/** Fecha de un timestamp UTC de D1 ("YYYY-MM-DD HH:MM:SS"); `null` si no se puede leer. */
export function parseUtc(sqliteUtc: string): Date | null {
  const date = new Date(`${sqliteUtc.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Crear un `Intl.DateTimeFormat` es caro y se formatea una vez por fila: se reutiliza uno por conjunto de opciones. */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  const cached = formatters.get(key);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat('es-PE', { timeZone: LIMA_TZ, ...options });
  formatters.set(key, created);
  return created;
}

function format(sqliteUtc: string, options: Intl.DateTimeFormatOptions): string {
  const date = parseUtc(sqliteUtc);
  if (!date) return sqliteUtc;
  return formatterFor(options).format(date);
}

/** "Domingo 22 de noviembre de 2026". */
export function formatLimaLongDate(sqliteUtc: string): string {
  const text = format(sqliteUtc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "6:05 p. m." */
export function formatLimaTime(sqliteUtc: string): string {
  return format(sqliteUtc, { hour: 'numeric', minute: '2-digit' });
}

/** "22/11/26, 6:05 p. m." */
export function formatLimaShort(sqliteUtc: string): string {
  return format(sqliteUtc, { dateStyle: 'short', timeStyle: 'short' });
}

/** "6:05 p. m. – 11:30 p. m." (o solo la apertura si aún no cierra). */
export function formatShiftRange(openedAt: string, closedAt: string | null): string {
  const from = formatLimaTime(openedAt);
  return closedAt ? `${from} – ${formatLimaTime(closedAt)}` : `Desde ${from}`;
}

/** Día de Lima de un instante, "YYYY-MM-DD" (para nombrar archivos). */
export function limaDay(sqliteUtc: string): string {
  return parseUtc(sqliteUtc) ? localDate(sqliteUtc) : 'cierre';
}

export function averageTicketCents(summary: Pick<CashSessionSummary, 'salesCount' | 'totalSalesCents'>): number {
  return summary.salesCount > 0 ? Math.round(summary.totalSalesCents / summary.salesCount) : 0;
}

/** Porcentaje entero de `part` sobre `total` (0 si no hay total). */
export function percentOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
