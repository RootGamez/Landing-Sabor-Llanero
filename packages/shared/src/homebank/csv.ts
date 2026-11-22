/**
 * Parser del CSV de HomeBank: separador `;`, columnas
 * `date;payment;info;payee;memo;amount;category;tags`, con o sin encabezado.
 */
import { toCents } from '../money';
import { type HomebankDateFormat, parseCsvDate } from './dates';
import { checkInputSize, MAX_HOMEBANK_ROWS, tooManyRowsResult } from './limits';
import { parsePaymentCode } from './payment';
import { cleanText } from './text';
import type { HomebankParseError, HomebankParseResult, HomebankRow } from './types';

export { paymentCodeToMethod } from './payment';

export interface HomebankCsvOptions {
  /** Orden día/mes para fechas `NN/NN/YY(YY)`; sin él, solo se acepta lo inequívoco. */
  dateFormat?: HomebankDateFormat;
}

const SEPARATOR = ';';
const MIN_COLUMNS = 6;
const BOM = '﻿';
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

interface CsvRecord {
  fields: string[];
  line: number;
  isUnclosed: boolean;
}

/** Divide en registros respetando comillas (con `""` escapado y saltos de línea dentro de comillas). */
function splitRecords(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let startLine = 1;

  const endRecord = (): void => {
    fields.push(field);
    if (fields.length > 1 || (fields[0] ?? '').trim() !== '') {
      records.push({ fields, line: startLine, isUnclosed: false });
    }
    fields = [];
    field = '';
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (inQuotes) {
      if (char === '"' && text.charAt(i + 1) === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
        if (char === '\n') line += 1;
      }
    } else if (char === '"' && field === '') {
      inQuotes = true;
    } else if (char === SEPARATOR) {
      fields.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text.charAt(i + 1) === '\n') i += 1;
      endRecord();
      line += 1;
      startLine = line;
    } else {
      field += char;
    }
  }
  if (inQuotes) {
    fields.push(field);
    records.push({ fields, line: startLine, isUnclosed: true });
  } else if (field !== '' || fields.length > 0) {
    endRecord();
  }
  return records;
}

/**
 * Monto con `.` o `,` decimal → céntimos con signo. Si aparecen ambos
 * separadores, el último es el decimal. Rechaza más de 2 decimales (p. ej.
 * "1,234" es ambiguo) en vez de adivinar.
 */
function parseCsvAmount(raw: string): number {
  let text = raw.replace(/[\s ]/g, '');
  const isNegative = text.startsWith('-');
  if (isNegative || text.startsWith('+')) text = text.slice(1);

  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const thousands = lastDot > lastComma ? ',' : '.';
    text = text.split(thousands).join('');
  }
  text = text.replace(',', '.');
  if (!AMOUNT_PATTERN.test(text)) throw new RangeError(`monto inválido: "${raw}"`);

  const cents = toCents(Number(text));
  return isNegative && cents !== 0 ? -cents : cents;
}

function recordToRow(fields: readonly string[], options: HomebankCsvOptions): HomebankRow {
  if (fields.length < MIN_COLUMNS) {
    throw new RangeError(`se esperaban al menos ${MIN_COLUMNS} columnas y hay ${fields.length}`);
  }
  const [date = '', payment, info, payee, memo, amount = '', category, tags] = fields;
  return {
    date: parseCsvDate(date, options.dateFormat),
    amountCents: parseCsvAmount(amount),
    category: cleanText(category),
    payee: cleanText(payee),
    memo: cleanText(memo),
    info: cleanText(info),
    tags: cleanText(tags),
    paymentMethod: parsePaymentCode(payment),
  };
}

function isHeader(record: CsvRecord | undefined): boolean {
  return record !== undefined && (record.fields[0] ?? '').trim().toLowerCase() === 'date';
}

/** Parsea el CSV de HomeBank: nunca lanza; las filas malas van a `errors` con su línea. */
export function parseHomebankCsv(text: string, options: HomebankCsvOptions = {}): HomebankParseResult {
  const oversize = checkInputSize(text);
  if (oversize !== null) return oversize;

  const all = splitRecords(text.startsWith(BOM) ? text.slice(1) : text);
  const records = isHeader(all[0]) ? all.slice(1) : all;
  if (records.length > MAX_HOMEBANK_ROWS) return tooManyRowsResult();

  const rows: HomebankRow[] = [];
  const errors: HomebankParseError[] = [];
  for (const record of records) {
    try {
      if (record.isUnclosed) throw new RangeError('comilla sin cerrar');
      rows.push(recordToRow(record.fields, options));
    } catch (error: unknown) {
      errors.push({ line: record.line, message: error instanceof Error ? error.message : 'fila inválida' });
    }
  }
  return { rows, errors };
}
