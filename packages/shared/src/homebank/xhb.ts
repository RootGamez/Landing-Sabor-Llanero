/**
 * Parser de HomeBank `.xhb` (XML nativo) sin DOM ni dependencias, para correr
 * igual en Workers y navegador. El formato solo usa etiquetas auto-cerradas
 * con atributos (`<cat/>`, `<pay/>`, `<ope/>`), así que basta un tokenizador.
 */
import { toCents } from '../money';
import { checkInputSize, MAX_HOMEBANK_ROWS, tooManyRowsResult } from './limits';
import { parsePaymentCode } from './payment';
import { cleanText } from './text';
import type { HomebankParseError, HomebankParseResult, HomebankRow } from './types';

/** Ordinal gregoriano proléptico de 1970-01-01 (Python `date(1970,1,1).toordinal()`). */
const EPOCH_ORDINAL = 719_163;
/** Ordinal de 9999-12-31: más allá, `Date` y 'YYYY-MM-DD' dejan de ser fiables. */
const MAX_ORDINAL = 3_652_059;
const MS_PER_DAY = 86_400_000;
/** Profundidad máxima al subir por `parent`: corta ciclos en archivos corruptos. */
const MAX_CATEGORY_DEPTH = 5;

const ENTITY_PATTERN = /&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g;
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};
const TAG_PATTERN =
  /<(cat|pay|ope)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*\/?>/g;
const ATTRIBUTE_PATTERN = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const XML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

/** Decodifica en una sola pasada (sin doble decodificación) las entidades XML estándar y numéricas. */
export function decodeXmlEntities(text: string): string {
  return text.replace(ENTITY_PATTERN, (match, body: string) => {
    const named = NAMED_ENTITIES[body];
    if (named !== undefined) return named;
    const codePoint = body.startsWith('#x') ? parseInt(body.slice(2), 16) : Number(body.slice(1));
    const isScalar =
      Number.isInteger(codePoint) &&
      codePoint > 0 &&
      codePoint <= 0x10ffff &&
      !(codePoint >= 0xd800 && codePoint <= 0xdfff);
    return isScalar ? String.fromCodePoint(codePoint) : match;
  });
}

/** Ordinal GLib/Python (día 1 = 0001-01-01) → 'YYYY-MM-DD'; `null` si está fuera de rango. */
export function ordinalToIsoDate(ordinal: number): string | null {
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > MAX_ORDINAL) return null;
  return new Date((ordinal - EPOCH_ORDINAL) * MS_PER_DAY).toISOString().slice(0, 10);
}

function parseAttributes(source: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of source.matchAll(ATTRIBUTE_PATTERN)) {
    const name = match[1];
    if (name !== undefined) attributes.set(name, decodeXmlEntities(match[2] ?? match[3] ?? ''));
  }
  return attributes;
}

interface Tag {
  kind: string;
  attributes: Map<string, string>;
  line: number;
}

/** Tokeniza etiquetas `cat|pay|ope` conservando el número de línea (los comentarios se anulan sin perder saltos). */
function tokenize(xml: string): Tag[] {
  const text = xml.replace(XML_COMMENT_PATTERN, (comment) => comment.replace(/[^\n]/g, ''));
  const tags: Tag[] = [];
  let line = 1;
  let scanned = 0;
  for (const match of text.matchAll(TAG_PATTERN)) {
    for (let at = text.indexOf('\n', scanned); at !== -1 && at < match.index; at = text.indexOf('\n', scanned)) {
      line += 1;
      scanned = at + 1;
    }
    tags.push({ kind: match[1] ?? '', attributes: parseAttributes(match[2] ?? ''), line });
  }
  return tags;
}

interface Category {
  name: string;
  parent: string | undefined;
}

function resolveCategory(key: string | undefined, categories: ReadonlyMap<string, Category>): string {
  const names: string[] = [];
  let current = key;
  for (let depth = 0; current !== undefined && depth < MAX_CATEGORY_DEPTH; depth += 1) {
    const category = categories.get(current);
    if (category === undefined) break;
    names.unshift(category.name);
    current = category.parent;
  }
  return names.join(':');
}

interface Lookups {
  categories: ReadonlyMap<string, Category>;
  payees: ReadonlyMap<string, string>;
}

function collectLookups(tags: readonly Tag[]): Lookups {
  const categories = new Map<string, Category>();
  const payees = new Map<string, string>();
  for (const { kind, attributes } of tags) {
    const key = attributes.get('key');
    if (key === undefined) continue;
    const name = cleanText(attributes.get('name'));
    if (kind === 'cat') categories.set(key, { name, parent: attributes.get('parent') });
    if (kind === 'pay') payees.set(key, name);
  }
  return { categories, payees };
}

function parseSignedAmount(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') throw new RangeError('monto ausente');
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new RangeError(`monto inválido: ${raw}`);
  const cents = toCents(Math.abs(value));
  return value < 0 && cents !== 0 ? -cents : cents;
}

function opToRow(attributes: ReadonlyMap<string, string>, lookups: Lookups): HomebankRow {
  const rawDate = attributes.get('date') ?? '';
  const date = /^\d+$/.test(rawDate) ? ordinalToIsoDate(Number(rawDate)) : null;
  if (date === null) throw new RangeError(`fecha inválida: "${rawDate}"`);
  const payeeKey = attributes.get('payee');
  return {
    date,
    amountCents: parseSignedAmount(attributes.get('amount')),
    category: resolveCategory(attributes.get('category'), lookups.categories),
    payee: payeeKey === undefined ? '' : (lookups.payees.get(payeeKey) ?? ''),
    memo: cleanText(attributes.get('wording')),
    info: cleanText(attributes.get('info')),
    tags: cleanText(attributes.get('tags')),
    paymentMethod: parsePaymentCode(attributes.get('paymode')),
  };
}

/** Parsea un `.xhb`: nunca lanza; las ops malas van a `errors` con su línea. */
export function parseXhb(xml: string): HomebankParseResult {
  const oversize = checkInputSize(xml);
  if (oversize !== null) return oversize;

  const tags = tokenize(xml);
  const ops = tags.filter((tag) => tag.kind === 'ope');
  if (ops.length > MAX_HOMEBANK_ROWS) return tooManyRowsResult();

  const lookups = collectLookups(tags);
  const rows: HomebankRow[] = [];
  const errors: HomebankParseError[] = [];
  for (const { attributes, line } of ops) {
    try {
      rows.push(opToRow(attributes, lookups));
    } catch (error: unknown) {
      errors.push({ line, message: error instanceof Error ? error.message : 'operación inválida' });
    }
  }
  return { rows, errors };
}
