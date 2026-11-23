import {
  QUICK_PERIODS,
  isValidLocalDate,
  resolveQuickPeriod,
  todayLocal,
  type QuickPeriod,
  type ReportGranularity,
  type ReportRange,
} from '@sabor/shared';

/** Período elegido: uno rápido o un rango propio. Vive en la URL (`?p=&from=&to=`). */
export type PeriodKey = QuickPeriod | 'personalizado';

export const PERIOD_OPTIONS: ReadonlyArray<{ key: PeriodKey; label: string }> = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'ayer', label: 'Ayer' },
  { key: '7d', label: 'Últimos 7 días' },
  { key: '30d', label: 'Últimos 30 días' },
  { key: 'mes', label: 'Este mes' },
  { key: 'mes-pasado', label: 'Mes pasado' },
  { key: 'anio', label: 'Este año' },
  { key: 'personalizado', label: 'Personalizado' },
];

export const DEFAULT_PERIOD: QuickPeriod = 'mes';

export interface ResolvedPeriod {
  key: PeriodKey;
  range: ReportRange;
}

const isQuickPeriod = (value: string | null): value is QuickPeriod =>
  value !== null && (QUICK_PERIODS as readonly string[]).includes(value);

/** Lee el período de la URL; cualquier valor inválido cae al mes en curso. */
export function periodFromParams(params: URLSearchParams, today: string = todayLocal()): ResolvedPeriod {
  const key = params.get('p');
  if (isQuickPeriod(key)) return { key, range: resolveQuickPeriod(key, today) };
  const from = params.get('from');
  const to = params.get('to');
  if (key === 'personalizado' && from && to && isValidLocalDate(from) && isValidLocalDate(to) && from <= to) {
    return { key: 'personalizado', range: { from, to } };
  }
  return { key: DEFAULT_PERIOD, range: resolveQuickPeriod(DEFAULT_PERIOD, today) };
}

/** Parámetros de URL de un período (el rápido no guarda fechas: siempre se recalcula contra "hoy"). */
export function periodToParams(key: PeriodKey, range: ReportRange): Record<string, string> {
  return key === 'personalizado' ? { p: key, from: range.from, to: range.to } : { p: key };
}

const dayFormat = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' });
const dayYearFormat = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
const monthFormat = new Intl.DateTimeFormat('es-PE', { month: 'short', year: '2-digit' });
const weekdayFormat = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });

/** 'YYYY-MM-DD' → Date a mediodía local (evita saltos de día por zona horaria del navegador). */
const parseDay = (day: string): Date => new Date(`${day}T12:00:00`);

export function formatDayShort(day: string): string {
  return dayFormat.format(parseDay(day));
}

export function formatRangeLabel(range: ReportRange): string {
  if (range.from === range.to) return dayYearFormat.format(parseDay(range.from));
  return `${dayFormat.format(parseDay(range.from))} – ${dayYearFormat.format(parseDay(range.to))}`;
}

/** Etiqueta corta del eje X según el bucket. */
export function formatBucketAxis(bucket: string, granularity: ReportGranularity): string {
  return granularity === 'month' ? monthFormat.format(parseDay(bucket)) : dayFormat.format(parseDay(bucket));
}

/** Etiqueta completa para tooltips y tabla accesible. */
export function formatBucketLong(bucket: string, granularity: ReportGranularity): string {
  if (granularity === 'month') return monthFormat.format(parseDay(bucket));
  if (granularity === 'week') return `Semana del ${dayFormat.format(parseDay(bucket))}`;
  return weekdayFormat.format(parseDay(bucket));
}

export const GRANULARITY_LABELS: Record<ReportGranularity, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
};

export const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;
export const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

export const hourLabel = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;

const countFormat = new Intl.NumberFormat('es-PE');
const percentFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
const shareFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 });

export const formatCount = (n: number): string => countFormat.format(n);

/** "+12,5 %" / "-3 %" / "0 %". */
export const formatDeltaPct = (pct: number): string => `${percentFormat.format(pct)} %`;

/** "25,3 %" (margen neto; negativo si hay pérdida). */
export const formatMargin = (pct: number): string => `${new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(pct)} %`;

/** Porción de un total como "35 %" (0 si el total es 0). */
export const formatShare = (part: number, total: number): string =>
  `${shareFormat.format(total > 0 ? (part / total) * 100 : 0)} %`;

/** Eje Y: soles enteros con separador de miles ("S/ 1,200"). */
export const formatAxisSoles = (cents: number): string => `S/ ${countFormat.format(Math.round(cents / 100))}`;

/** Marcas "redondas" del eje Y: `count + 1` valores de 0 a un máximo múltiplo de un paso 1/2/5×10ⁿ. */
export function niceTicks(maxValue: number, count: number): number[] {
  if (maxValue <= 0) return [0, 1];
  const rawStep = maxValue / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  return Array.from({ length: Math.ceil(maxValue / step) + 1 }, (_, i) => i * step);
}

/** Como `niceTicks` pero admite valores negativos (ganancia neta en pérdida): marcas de `min` a `max` redondeadas al paso. */
export function niceTicksRange(minValue: number, maxValue: number, count: number): number[] {
  if (minValue >= 0) return niceTicks(maxValue, count);
  const span = Math.max(maxValue, 0) - minValue;
  const rawStep = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const first = Math.floor(minValue / step);
  const last = Math.max(Math.ceil(maxValue / step), 1);
  return Array.from({ length: last - first + 1 }, (_, i) => (first + i) * step);
}
