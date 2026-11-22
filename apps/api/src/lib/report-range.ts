import type { Context } from 'hono';
import {
  addLocalDays,
  isValidLocalDate,
  localRangeDays,
  localDayRangeUtc,
  todayLocal,
  type ReportGranularity,
  type ReportRange,
  type UtcRange,
} from '@sabor/shared';
import type { AppEnv } from '../env';
import { badRequest } from './http-error';

/** Tope del rango pedido: acota el relleno de huecos y las consultas (≈10 años). */
export const MAX_RANGE_DAYS = 3660;

const MS_PER_DAY = 86_400_000;

function toUtcMs(day: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Período inmediatamente anterior, de igual largo (para los deltas). */
export function previousRange(range: ReportRange): ReportRange {
  const days = localRangeDays(range);
  return { from: addLocalDays(range.from, -days), to: addLocalDays(range.from, -1) };
}

/** Primer día del bucket que contiene `day`: el mismo día, el lunes de su semana o el día 1 de su mes. */
export function bucketStart(day: string, granularity: ReportGranularity): string {
  if (granularity === 'day') return day;
  if (granularity === 'month') return `${day.slice(0, 7)}-01`;
  const dow = new Date(toUtcMs(day)).getUTCDay(); // 0 = domingo
  return addLocalDays(day, -((dow + 6) % 7));
}

function nextBucket(bucket: string, granularity: ReportGranularity): string {
  if (granularity === 'day') return addLocalDays(bucket, 1);
  if (granularity === 'week') return addLocalDays(bucket, 7);
  const date = new Date(toUtcMs(bucket));
  return fromUtcMs(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

/** Todos los buckets del rango, en orden y sin huecos. */
export function enumerateBuckets(range: ReportRange, granularity: ReportGranularity): string[] {
  const buckets: string[] = [];
  const last = bucketStart(range.to, granularity);
  for (let b = bucketStart(range.from, granularity); b <= last; b = nextBucket(b, granularity)) {
    buckets.push(b);
  }
  return buckets;
}

function dateParam(c: Context<AppEnv>, name: 'from' | 'to'): string | undefined {
  const value = c.req.query(name);
  if (value === undefined || value === '') return undefined;
  if (!isValidLocalDate(value)) throw badRequest(`${name} inválido (formato esperado: YYYY-MM-DD)`);
  return value;
}

/**
 * `?from&to` (días locales de Lima, inclusivos). Sin parámetros: el mes en
 * curso hasta hoy. Valida orden y largo máximo.
 */
export function parseReportRange(c: Context<AppEnv>, now: Date = new Date()): ReportRange {
  const today = todayLocal(now);
  const to = dateParam(c, 'to') ?? today;
  const from = dateParam(c, 'from') ?? `${to.slice(0, 7)}-01`;
  if (from > to) throw badRequest('from no puede ser posterior a to');
  if (localRangeDays({ from, to }) > MAX_RANGE_DAYS) {
    throw badRequest(`El rango no puede superar ${MAX_RANGE_DAYS} días`);
  }
  return { from, to };
}

export function parseGranularity(c: Context<AppEnv>): ReportGranularity {
  const value = c.req.query('granularity') ?? 'day';
  if (value !== 'day' && value !== 'week' && value !== 'month') {
    throw badRequest('granularity inválida (day, week o month)');
  }
  return value;
}

/** Rango de días locales → ventana UTC semiabierta `[fromUtc, toUtc)` comparable con `created_at`. */
export function utcWindow(range: ReportRange): UtcRange {
  return { fromUtc: localDayRangeUtc(range.from).fromUtc, toUtc: localDayRangeUtc(range.to).toUtc };
}
