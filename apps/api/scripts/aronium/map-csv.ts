import { SIZE_KEYS, type MapRow, type MapStatus, type SizeKey } from './types';

const HEADER = ['legacy_id', 'legacy_name', 'legacy_group', 'item_id', 'size_key', 'status'] as const;
const BOM = '﻿';

function quoteField(value: string): string {
  return /[",;\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** CSV con BOM para que Excel (es-PE) respete la ñ y los acentos. */
export function serializeMapCsv(rows: readonly MapRow[]): string {
  const lines = rows.map((row) =>
    [row.legacyId, row.legacyName, row.legacyGroup, row.itemId ?? '', row.sizeKey ?? '', row.status]
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

function parseRow(fields: readonly string[], line: number): MapRow {
  const [id, name = '', group = '', item = '', size = '', status = ''] = fields.map((f) => f.trim());
  const legacyId = Number(id);
  if (!Number.isInteger(legacyId) || legacyId <= 0) throw new Error(`línea ${line}: legacy_id inválido ("${id}")`);
  const itemId = item === '' ? null : Number(item);
  if (itemId !== null && (!Number.isInteger(itemId) || itemId <= 0)) {
    throw new Error(`línea ${line}: item_id debe ser un entero positivo o quedar vacío ("${item}")`);
  }
  if (size !== '' && !(SIZE_KEYS as readonly string[]).includes(size)) {
    throw new Error(`línea ${line}: size_key debe ser ${SIZE_KEYS.join('|')} o quedar vacío ("${size}")`);
  }
  const mapStatus: MapStatus = status === 'auto' ? 'auto' : 'unmatched';
  return {
    legacyId,
    legacyName: name,
    legacyGroup: group,
    itemId,
    sizeKey: size === '' ? null : (size as SizeKey),
    status: mapStatus,
  };
}

export function parseMapCsv(csv: string): MapRow[] {
  const text = csv.startsWith(BOM) ? csv.slice(1) : csv;
  const records = splitRecords(text, detectDelimiter(text));
  const rows: MapRow[] = [];
  records.forEach((fields, index) => {
    if (index === 0 || fields.every((f) => f.trim() === '')) return;
    rows.push(parseRow(fields, index + 1));
  });
  return rows;
}
