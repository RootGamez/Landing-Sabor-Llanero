import { SIZE_KEYS, type MapRow, type MapStatus, type SizeKey } from './types';

const HEADER = ['legacy_id', 'legacy_name', 'legacy_group', 'item_id', 'item_slug', 'size_key', 'status'] as const;
const REQUIRED_COLUMNS = ['legacy_id', 'legacy_name'] as const;
const BOM = '﻿';
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function quoteField(value: string): string {
  return /[",;\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** CSV con BOM para que Excel (es-PE) respete la ñ y los acentos. */
export function serializeMapCsv(rows: readonly MapRow[]): string {
  const lines = rows.map((row) =>
    [row.legacyId, row.legacyName, row.legacyGroup, row.itemId ?? '', row.itemSlug ?? '', row.sizeKey ?? '', row.status]
      .map((field) => quoteField(String(field)))
      .join(','),
  );
  return `${BOM}${[HEADER.join(','), ...lines].join('\r\n')}\r\n`;
}

/** Parte el texto en registros de campos respetando comillas (con saltos de línea dentro). */
function splitRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || record.length > 0) records.push([...record, field]);
  return records;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  return firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
}

/** Posición de cada columna por nombre: el orden no importa y item_slug es opcional (CSV viejo). */
function indexColumns(header: readonly string[]): Map<string, number> {
  const columns = new Map(header.map((name, index) => [name.trim().toLowerCase(), index]));
  for (const required of REQUIRED_COLUMNS) {
    if (!columns.has(required)) throw new Error(`línea 1: falta la columna ${required}`);
  }
  return columns;
}

function parseRow(get: (column: string) => string, line: number): MapRow {
  const id = get('legacy_id');
  const legacyId = Number(id);
  if (!Number.isInteger(legacyId) || legacyId <= 0) throw new Error(`línea ${line}: legacy_id inválido ("${id}")`);
  const item = get('item_id');
  const itemId = item === '' ? null : Number(item);
  if (itemId !== null && (!Number.isInteger(itemId) || itemId <= 0)) {
    throw new Error(`línea ${line}: item_id debe ser un entero positivo o quedar vacío ("${item}")`);
  }
  const slug = get('item_slug');
  if (slug !== '' && !SLUG_PATTERN.test(slug)) {
    throw new Error(`línea ${line}: item_slug solo admite minúsculas, números y guiones ("${slug}")`);
  }
  const size = get('size_key');
  if (size !== '' && !(SIZE_KEYS as readonly string[]).includes(size)) {
    throw new Error(`línea ${line}: size_key debe ser ${SIZE_KEYS.join('|')} o quedar vacío ("${size}")`);
  }
  const status: MapStatus = get('status') === 'auto' ? 'auto' : 'unmatched';
  return {
    legacyId,
    legacyName: get('legacy_name'),
    legacyGroup: get('legacy_group'),
    itemId,
    itemSlug: slug === '' ? null : slug,
    sizeKey: size === '' ? null : (size as SizeKey),
    status,
  };
}

export function parseMapCsv(csv: string): MapRow[] {
  const text = csv.startsWith(BOM) ? csv.slice(1) : csv;
  const [header, ...records] = splitRecords(text, detectDelimiter(text));
  const columns = indexColumns(header ?? []);
  const rows: MapRow[] = [];
  records.forEach((fields, index) => {
    if (fields.every((f) => f.trim() === '')) return;
    const get = (column: string): string => {
      const position = columns.get(column);
      return position === undefined ? '' : (fields[position] ?? '').trim();
    };
    rows.push(parseRow(get, index + 2));
  });
  return rows;
}
