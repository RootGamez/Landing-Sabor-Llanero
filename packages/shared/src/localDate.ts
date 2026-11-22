/**
 * Día local de Lima (Plan Parte 3, D2). America/Lima es UTC-5 fijo, sin
 * horario de verano, así que un offset constante es exacto y evita depender
 * de `Intl`/zonas horarias del runtime. Los timestamps se guardan en UTC con
 * `datetime('now')` ("YYYY-MM-DD HH:MM:SS", sin zona); toda agrupación por
 * día pasa por acá (o por `date(created_at, '-5 hours')` en SQL).
 */

export const LIMA_OFFSET_MINUTES = -300;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const LOCAL_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const SQLITE_UTC_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

const pad = (n: number): string => String(n).padStart(2, '0');

/** YYYY-MM-DD de un instante, leído en UTC (el instante ya viene corrido al huso deseado). */
function utcDateString(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** 'YYYY-MM-DD' real del calendario (rechaza 2026-02-30, 2026-1-1, etc.). */
export function isValidLocalDate(value: string): boolean {
  const match = LOCAL_DATE_REGEX.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const parsed = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return utcDateString(parsed) === value;
}

function toInstant(input: string | Date): Date {
  const date =
    input instanceof Date
      ? input
      : new Date(SQLITE_UTC_REGEX.test(input) ? `${input.replace(' ', 'T')}Z` : input);
  if (typeof input === 'string' && input === '') {
    throw new RangeError('fecha vacía');
  }
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`fecha inválida: ${String(input)}`);
  }
  return date;
}

/**
 * Instante UTC (ISO, formato SQLite `datetime('now')` tratado como UTC, o
 * `Date`) → día calendario de Lima 'YYYY-MM-DD'.
 */
export function localDate(input: string | Date): string {
  const instant = toInstant(input);
  return utcDateString(new Date(instant.getTime() + LIMA_OFFSET_MINUTES * MS_PER_MINUTE));
}

/** Día de Lima de "ahora" (reloj inyectable para tests deterministas). */
export function todayLocal(now: Date = new Date()): string {
  return localDate(now);
}

export interface UtcRange {
  /** Inclusivo: `created_at >= fromUtc`. */
  fromUtc: string;
  /** Exclusivo: `created_at < toUtc`. */
  toUtc: string;
}

function toSqliteUtc(date: Date): string {
  return `${utcDateString(date)} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

/**
 * Día de Lima → rango UTC semiabierto `[fromUtc, toUtc)` en el mismo formato
 * que `datetime('now')`, comparable como texto contra `created_at` en SQLite.
 */
export function localDayRangeUtc(day: string): UtcRange {
  if (!isValidLocalDate(day)) {
    throw new RangeError(`fecha local inválida (se espera YYYY-MM-DD): ${day}`);
  }
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const startUtcMs = Date.UTC(y, m - 1, d) - LIMA_OFFSET_MINUTES * MS_PER_MINUTE;
  return {
    fromUtc: toSqliteUtc(new Date(startUtcMs)),
    toUtc: toSqliteUtc(new Date(startUtcMs + MS_PER_DAY)),
  };
}
