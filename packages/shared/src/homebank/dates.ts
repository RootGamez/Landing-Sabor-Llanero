/** Orden día/mes de las fechas con separador `/` o `-` del CSV de HomeBank. */
export type HomebankDateFormat = 'DD/MM' | 'MM/DD';

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const TWO_DIGIT_YEAR_BASE = 2000;
const MAX_MONTH = 12;
const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_PATTERN = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})$/;

function toIso(year: number, month: number, day: number, raw: string): string {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const isValid =
    year >= MIN_YEAR && year <= MAX_YEAR && month >= 1 && month <= MAX_MONTH && day >= 1 && day <= daysInMonth;
  if (!isValid) throw new RangeError(`fecha inválida: "${raw}"`);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Resuelve día/mes sin adivinar: solo infiere DD/MM cuando es inequívoco. */
function inferFormat(first: number, second: number, raw: string): HomebankDateFormat {
  if (first === second || (first > MAX_MONTH && second <= MAX_MONTH)) return 'DD/MM';
  if (second > MAX_MONTH && first <= MAX_MONTH) {
    throw new RangeError(`fecha "${raw}" parece MM/DD: indica dateFormat explícito ('MM/DD')`);
  }
  if (first > MAX_MONTH && second > MAX_MONTH) throw new RangeError(`fecha inválida: "${raw}"`);
  throw new RangeError(`fecha ambigua "${raw}": indica dateFormat ('DD/MM' o 'MM/DD')`);
}

/**
 * Fecha del CSV → 'YYYY-MM-DD'. Acepta `YYYY-MM-DD` siempre y `DD/MM/YY(YY)`,
 * `DD-MM-YY(YY)`; `MM/DD` solo con `dateFormat` explícito. Lanza `RangeError`
 * con un mensaje apto para mostrar por fila.
 */
export function parseCsvDate(raw: string, dateFormat?: HomebankDateFormat): string {
  const text = raw.trim();
  const iso = ISO_PATTERN.exec(text);
  if (iso) return toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]), raw);

  const local = LOCAL_PATTERN.exec(text);
  if (!local) throw new RangeError(`fecha inválida: "${raw}"`);
  const first = Number(local[1]);
  const second = Number(local[2]);
  const rawYear = Number(local[3]);
  const year = (local[3] ?? '').length === 2 ? TWO_DIGIT_YEAR_BASE + rawYear : rawYear;
  const format = dateFormat ?? inferFormat(first, second, raw);
  return format === 'DD/MM' ? toIso(year, second, first, raw) : toIso(year, first, second, raw);
}
