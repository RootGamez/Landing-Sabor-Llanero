import { isValidLocalDate, todayLocal } from '@sabor/shared';

/*
 * Utilidades de fecha para los pickers. Todo se maneja como 'YYYY-MM-DD'
 * (día de calendario de Lima) y la aritmética se hace en UTC para no
 * depender de la zona del navegador ni del horario de verano.
 */

export const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

/** Semana desde lunes. */
export const WEEKDAYS_SHORT = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'] as const;
export const WEEKDAYS_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;

const MS_PER_DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

export function today(): string {
  return todayLocal();
}

export function isISODate(value: string | undefined | null): value is string {
  return !!value && isValidLocalDate(value);
}

function toDate(iso: string): Date {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISO(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function makeISO(year: number, monthIndex: number, day: number): string {
  return toISO(new Date(Date.UTC(year, monthIndex, day)));
}

export function addDays(iso: string, days: number): string {
  return toISO(new Date(toDate(iso).getTime() + days * MS_PER_DAY));
}

/** Suma meses conservando el día (recortado al último día del mes destino). */
export function addMonths(iso: string, months: number): string {
  const date = toDate(iso);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return makeISO(target.getUTCFullYear(), target.getUTCMonth(), Math.min(date.getUTCDate(), lastDay));
}

/** 0 = lunes … 6 = domingo. */
export function weekdayIndex(iso: string): number {
  return (toDate(iso).getUTCDay() + 6) % 7;
}

export function parts(iso: string): { year: number; month: number; day: number } {
  const date = toDate(iso);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
}

/** 6 semanas × 7 días (lunes a domingo) que cubren el mes de `iso`. */
export function monthGrid(iso: string): string[][] {
  const { year, month } = parts(iso);
  const first = makeISO(year, month, 1);
  const start = addDays(first, -weekdayIndex(first));
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day))
  );
}

export function clampDate(iso: string, min?: string, max?: string): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

/** "22 nov 2026" */
export function formatDisplay(iso: string): string {
  const { year, month, day } = parts(iso);
  return `${day} ${MONTHS_SHORT[month]} ${year}`;
}

/** "sábado, 22 de noviembre de 2026" (nombre accesible de cada día). */
export function formatLong(iso: string): string {
  const { year, month, day } = parts(iso);
  return `${WEEKDAYS_LONG[weekdayIndex(iso)]}, ${day} de ${MONTHS[month]} de ${year}`;
}

/** "noviembre de 2026" desde 'YYYY-MM'. */
export function formatMonthLong(period: string): string {
  const [year = 0, month = 1] = period.split('-').map(Number);
  return `${MONTHS[month - 1]} de ${year}`;
}

export function isPeriod(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function startOfMonth(iso: string): string {
  const { year, month } = parts(iso);
  return makeISO(year, month, 1);
}

export function endOfMonth(iso: string): string {
  const { year, month } = parts(iso);
  return makeISO(year, month + 1, 0);
}
