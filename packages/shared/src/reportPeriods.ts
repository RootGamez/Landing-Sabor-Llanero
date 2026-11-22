import { addLocalDays } from './localDate';
import type { ReportGranularity, ReportRange } from './reports';

/** Períodos rápidos del dashboard; "personalizado" lleva su propio from/to. */
export const QUICK_PERIODS = ['hoy', '7d', 'mes', 'mes-pasado', 'anio'] as const;
export type QuickPeriod = (typeof QUICK_PERIODS)[number];

const MS_PER_DAY = 86_400_000;
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
    case '7d':
      return { from: addLocalDays(today, -6), to: today };
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
