import { addLocalDays } from './localDate';

/**
 * Proyección de ingresos al cierre del mes en curso. Función pura: recibe lo
 * vendido por día y "hoy" (días locales de Lima) y no toca red ni reloj.
 *
 * Método:
 *  1. Se usan solo los días COMPLETOS del mes (hasta ayer): hoy está a medias.
 *  2. Con menos de MIN_DAYS_FOR_PROJECTION días completos no se proyecta.
 *  3. Con al menos MIN_DAYS_FOR_WEEKDAY_PATTERN días completos (dos semanas),
 *     cada día restante vale el promedio de ese día de la semana en lo que va
 *     del mes (estacionalidad semanal: los sábados venden más que los lunes).
 *     Con menos, cada día restante vale el promedio diario simple.
 *  4. Hoy aporta lo vendido hasta ahora, o su promedio esperado si es mayor.
 *  5. El rango (bajo/alto) suma o resta la desviación típica diaria por la
 *     raíz de los días restantes; nunca baja de lo ya vendido.
 */

export const MIN_DAYS_FOR_PROJECTION = 7;
export const MIN_DAYS_FOR_WEEKDAY_PATTERN = 14;
const DAYS_PER_WEEK = 7;

export interface DailyIncome {
  /** Día local 'YYYY-MM-DD'. */
  day: string;
  incomeCents: number;
}

export type ProjectionMethod = 'weekday' | 'average';

export interface ProjectedDay {
  day: string;
  incomeCents: number;
}

export type MonthProjection =
  | { status: 'insufficient'; observedDays: number; minDays: number }
  | {
      status: 'ok';
      method: ProjectionMethod;
      observedDays: number;
      remainingDays: number;
      /** Vendido en el mes hasta hoy (incluye hoy). */
      actualCents: number;
      projectedCents: number;
      lowCents: number;
      highCents: number;
      /** Pronóstico por cada día desde hoy hasta fin de mes (hoy: lo esperado para el día completo). */
      days: ProjectedDay[];
    };

/** 0 = lunes … 6 = domingo, de un día 'YYYY-MM-DD'. */
function weekdayIndex(day: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % DAYS_PER_WEEK;
}

function monthLastDay(today: string): string {
  const [y, m] = today.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${today.slice(0, 7)}-${String(last).padStart(2, '0')}`;
}

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);
const mean = (values: readonly number[]): number => (values.length === 0 ? 0 : sum(values) / values.length);

function stdDev(values: readonly number[], avg: number): number {
  if (values.length < 2) return 0;
  return Math.sqrt(sum(values.map((v) => (v - avg) ** 2)) / (values.length - 1));
}

/** Promedio por día de la semana (índice 0-6) de los días completos; null si ese día no tiene datos. */
function weekdayAverages(history: readonly DailyIncome[]): Array<number | null> {
  return Array.from({ length: DAYS_PER_WEEK }, (_, wd) => {
    const values = history.filter((d) => weekdayIndex(d.day) === wd).map((d) => d.incomeCents);
    return values.length === 0 ? null : mean(values);
  });
}

/** Días del mes de `today`, de `monthStart` a `today`, rellenando con 0 los días sin ventas. */
function completeDays(daily: readonly DailyIncome[], today: string): DailyIncome[] {
  const byDay = new Map(daily.map((d) => [d.day, d.incomeCents]));
  const days: DailyIncome[] = [];
  for (let day = `${today.slice(0, 7)}-01`; day <= today; day = addLocalDays(day, 1)) {
    days.push({ day, incomeCents: byDay.get(day) ?? 0 });
  }
  return days;
}

export function projectMonthEnd(daily: readonly DailyIncome[], today: string): MonthProjection {
  const monthDays = completeDays(daily, today);
  const history = monthDays.filter((d) => d.day < today);
  if (history.length < MIN_DAYS_FOR_PROJECTION) {
    return { status: 'insufficient', observedDays: history.length, minDays: MIN_DAYS_FOR_PROJECTION };
  }

  const values = history.map((d) => d.incomeCents);
  const overall = mean(values);
  const method: ProjectionMethod = history.length >= MIN_DAYS_FOR_WEEKDAY_PATTERN ? 'weekday' : 'average';
  const byWeekday = weekdayAverages(history);
  const expectedFor = (day: string): number =>
    Math.round(method === 'weekday' ? (byWeekday[weekdayIndex(day)] ?? overall) : overall);

  const todaySoFar = monthDays[monthDays.length - 1]!.incomeCents;
  const days: ProjectedDay[] = [];
  for (let day = today; day <= monthLastDay(today); day = addLocalDays(day, 1)) {
    const expected = expectedFor(day);
    days.push({ day, incomeCents: day === today ? Math.max(expected, todaySoFar) : expected });
  }

  const actualCents = sum(monthDays.map((d) => d.incomeCents));
  const projectedCents = actualCents - todaySoFar + sum(days.map((d) => d.incomeCents));
  const spread = Math.round(stdDev(values, overall) * Math.sqrt(days.length));
  return {
    status: 'ok',
    method,
    observedDays: history.length,
    remainingDays: days.length - 1,
    actualCents,
    projectedCents,
    lowCents: Math.max(actualCents, projectedCents - spread),
    highCents: projectedCents + spread,
    days,
  };
}
