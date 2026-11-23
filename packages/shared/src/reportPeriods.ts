import { addLocalDays } from './localDate';
import type { ReportGranularity, ReportRange } from './reports';

/** Períodos rápidos del dashboard; "personalizado" lleva su propio from/to. */
export const QUICK_PERIODS = ['hoy', 'ayer', '7d', '30d', 'mes', 'mes-pasado', 'anio'] as const;
export type QuickPeriod = (typeof QUICK_PERIODS)[number];

const MS_PER_DAY = 86_400_000;
const LAST_30_DAYS = 30;
const WEEKLY_FROM_DAYS = 32;
const MONTHLY_FROM_DAYS = 181;

const monthStart = (day: string): string => `${day.slice(0, 7)}-01`;

/** Cantidad de días de un rango local, contando ambos extremos. */
export function localRangeDays(range: ReportRange): number {
  const toMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
  return Math.round((toMs(range.to) - toMs(range.from)) / MS_PER_DAY) + 1;
}

/** Rango (días locales de Lima) de un período rápido, dado el "hoy" local. */
export function resolveQuickPeriod(period: QuickPeriod, today: string): ReportRange {
  switch (period) {
    case 'hoy':
      return { from: today, to: today };
    case 'ayer': {
      const yesterday = addLocalDays(today, -1);
      return { from: yesterday, to: yesterday };
    }
    case '7d':
      return { from: addLocalDays(today, -6), to: today };
    case '30d':
      return { from: addLocalDays(today, -(LAST_30_DAYS - 1)), to: today };
    case 'mes':
      return { from: monthStart(today), to: today };
    case 'mes-pasado': {
      const lastDayPrevMonth = addLocalDays(monthStart(today), -1);
      return { from: monthStart(lastDayPrevMonth), to: lastDayPrevMonth };
    }
    case 'anio':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

/** Granularidad por defecto del gráfico en el tiempo según el largo del rango. */
export function autoGranularity(range: ReportRange): ReportGranularity {
  const days = localRangeDays(range);
  if (days < WEEKLY_FROM_DAYS) return 'day';
  return days < MONTHLY_FROM_DAYS ? 'week' : 'month';
}

const lastDayOfMonth = (monthPrefix: string): string => `${monthPrefix}-${String(monthLength(monthPrefix)).padStart(2, '0')}`;

/** Cantidad de días del mes 'YYYY-MM'. */
function monthLength(monthPrefix: string): number {
  const [year, month] = monthPrefix.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Mismo día del mes anterior, recortado al largo de ese mes (31 de marzo → 28 de febrero). */
function sameDayPreviousMonth(day: string): string {
  const prevMonthLastDay = addLocalDays(`${day.slice(0, 7)}-01`, -1);
  const dayOfMonth = Math.min(Number(day.slice(8, 10)), Number(prevMonthLastDay.slice(8, 10)));
  return `${prevMonthLastDay.slice(0, 7)}-${String(dayOfMonth).padStart(2, '0')}`;
}

/** Mismo día del año anterior (29 de febrero → 28 de febrero). */
function sameDayPreviousYear(day: string): string {
  const year = Number(day.slice(0, 4)) - 1;
  const candidate = `${year}${day.slice(4)}`;
  return candidate.endsWith('-02-29') && monthLength(`${year}-02`) === 28 ? `${year}-02-28` : candidate;
}

/**
 * Período equivalente anterior para comparar:
 *  - del día 1 de un mes hasta cualquier día de ese mes → el mes anterior hasta el mismo día
 *    (este mes hasta el 15 vs. el mes pasado hasta el 15; un mes completo vs. el mes anterior completo);
 *  - del 1 de enero hasta un día del mismo año → el año anterior hasta el mismo día;
 *  - cualquier otro rango → el período inmediatamente anterior de igual largo.
 */
export function comparisonRange(range: ReportRange): ReportRange {
  const sameMonth = range.from.slice(0, 7) === range.to.slice(0, 7);
  if (sameMonth && range.from.endsWith('-01')) {
    const isFullMonth = range.to === lastDayOfMonth(range.to.slice(0, 7));
    const from = `${addLocalDays(range.from, -1).slice(0, 7)}-01`;
    return { from, to: isFullMonth ? addLocalDays(range.from, -1) : sameDayPreviousMonth(range.to) };
  }
  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
  if (sameYear && range.from.endsWith('-01-01')) {
    return { from: sameDayPreviousYear(range.from), to: sameDayPreviousYear(range.to) };
  }
  const days = localRangeDays(range);
  return { from: addLocalDays(range.from, -days), to: addLocalDays(range.from, -1) };
}
