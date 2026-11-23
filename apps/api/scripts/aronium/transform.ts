import { cleanLegacyName } from './name-clean';
import { sizeFromGroup } from './product-map';
import type {
  ImportPlan,
  MapRow,
  RawData,
  RawDocument,
  RawItem,
  RawZReport,
  SaleItemRecord,
  SaleRecord,
  SessionRecord,
  SizeKey,
} from './types';

/** Lima no tiene horario de verano: UTC = hora local + 5 h todo el año. */
const LIMA_TO_UTC_HOURS = 5;
const MS_PER_HOUR = 3_600_000;
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;

export const SIZE_LABELS: Readonly<Record<SizeKey, string>> = {
  mediana: 'Mediana',
  grande: 'Grande',
  familiar: 'Familiar',
};

const PAYMENT_METHODS: Readonly<Record<string, string>> = {
  cash: 'efectivo',
  'credit card': 'tarjeta',
  'debit card': 'tarjeta',
  check: 'transferencia',
  voucher: 'transferencia',
  'gift card': 'transferencia',
};

const DEFAULT_PAYMENT_METHOD = 'efectivo';

/** Soles (float de SQLite) a céntimos enteros, sin errores tipo 1.005 -> 100. */
export function toCents(amount: number): number {
  return Math.round(Number.parseFloat((amount * 100).toPrecision(12)));
}

/** 0.5 -> "0,5" (coma decimal, sin ceros sobrantes). */
export function formatQuantity(quantity: number): string {
  return String(Number(quantity.toFixed(3))).replace('.', ',');
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** '2025-04-22 22:32:10.2184' (Lima) -> '2025-04-23 03:32:10' (UTC, formato datetime('now')). */
export function limaToUtc(local: string): string {
  const match = LOCAL_DATE_TIME.exec(local);
  if (!match) throw new Error(`Fecha con formato inesperado: "${local}"`);
  const [year = 0, month = 1, day = 0, hour = 0, minute = 0, second = 0] = match.slice(1).map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second) + LIMA_TO_UTC_HOURS * MS_PER_HOUR);
  const date = `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
  return `${date} ${pad(utc.getUTCHours())}:${pad(utc.getUTCMinutes())}:${pad(utc.getUTCSeconds())}`;
}

/** Día local 'YYYY-MM-DD' de una fecha de Aronium. */
export function localDay(local: string): string {
  return local.slice(0, 10);
}

/** Clave de payment_methods para un PaymentType de Aronium; null si no se conoce. */
export function mapPaymentMethod(typeName: string): string | null {
  return PAYMENT_METHODS[typeName.trim().toLowerCase()] ?? null;
}

interface LineContext {
  name: string;
  sizeKey: SizeKey | null;
  itemId: number | null;
  itemSlug: string | null;
}

/**
 * Una línea de Aronium a línea de venta. Cantidades enteras exactas se
 * conservan; las fraccionarias (media porción) van como quantity=1 con el
 * total íntegro, porque sale_items.quantity es INTEGER.
 */
function buildLine(item: RawItem, ctx: LineContext): SaleItemRecord | null {
  const lineTotalCents = toCents(item.total);
  if (lineTotalCents <= 0) return null;
  const unit = toCents(item.price);
  const exactWhole = Number.isInteger(item.quantity) && item.quantity > 0 && unit * item.quantity === lineTotalCents;
  const single = item.quantity === 1;
  const annotated = !exactWhole && !single;
  const baseName = cleanLegacyName(ctx.name);
  const nameSuffix = annotated ? ` (×${formatQuantity(item.quantity)})` : '';
  return {
    legacyProductId: item.productId,
    itemId: ctx.itemId,
    itemSlug: ctx.itemSlug,
    sizeKey: ctx.sizeKey,
    name: `${baseName}${nameSuffix}`,
    baseName,
    nameSuffix,
    sizeLabel: ctx.sizeKey ? SIZE_LABELS[ctx.sizeKey] : null,
    unitPriceCents: exactWhole ? unit : lineTotalCents,
    quantity: exactWhole ? item.quantity : 1,
    lineTotalCents,
  };
}

interface Lookups {
  context: Map<number, LineContext>;
  itemsByDoc: Map<number, RawItem[]>;
  paymentByDoc: Map<number, string>;
}

function groupBy<T>(rows: readonly T[], key: (row: T) => number): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    const list = grouped.get(key(row)) ?? [];
    list.push(row);
    grouped.set(key(row), list);
  }
  return grouped;
}

function buildLookups(raw: RawData, map: readonly MapRow[], warnings: string[]): Lookups {
  const mapById = new Map(map.map((row) => [row.legacyId, row]));
  const context = new Map<number, LineContext>();
  for (const product of raw.products) {
    const row = mapById.get(product.id);
    context.set(product.id, {
      name: product.name,
      itemId: row?.itemId ?? null,
      itemSlug: row?.itemSlug ?? null,
      sizeKey: row ? row.sizeKey : sizeFromGroup(product.groupName),
    });
  }
  const paymentByDoc = new Map<number, string>();
  for (const [docId, payments] of groupBy(raw.payments, (p) => p.documentId)) {
    const biggest = payments.reduce((a, b) => (b.amount > a.amount ? b : a));
    const method = mapPaymentMethod(biggest.typeName);
    if (!method) warnings.push(`doc ${docId}: tipo de pago desconocido "${biggest.typeName}", se usa efectivo`);
    paymentByDoc.set(docId, method ?? DEFAULT_PAYMENT_METHOD);
  }
  return { context, itemsByDoc: groupBy(raw.items, (i) => i.documentId), paymentByDoc };
}

function buildSale(doc: RawDocument, number: number, lookups: Lookups, warnings: string[]): SaleRecord | null {
  const items: SaleItemRecord[] = [];
  for (const raw of lookups.itemsByDoc.get(doc.id) ?? []) {
    const ctx = lookups.context.get(raw.productId) ?? { name: `Producto ${raw.productId}`, itemId: null, itemSlug: null, sizeKey: null };
    const line = buildLine(raw, ctx);
    if (line) items.push(line);
    else warnings.push(`doc ${doc.id}: línea de S/ 0 descartada (${ctx.name})`);
  }
  if (items.length === 0) {
    warnings.push(`doc ${doc.id}: sin líneas con importe, no se importa`);
    return null;
  }
  const subtotalCents = items.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const discountCents = subtotalCents - toCents(doc.total);
  if (discountCents < 0) warnings.push(`doc ${doc.id}: total mayor que las líneas, se usa la suma de líneas`);
  const discount = Math.max(0, discountCents);
  return {
    legacyRef: `aronium:doc:${doc.id}`,
    number,
    createdAtUtc: limaToUtc(doc.dateCreated),
    subtotalCents,
    discountCents: discount,
    totalCents: subtotalCents - discount,
    paymentMethod: lookups.paymentByDoc.get(doc.id) ?? DEFAULT_PAYMENT_METHOD,
    items,
  };
}

interface SessionKey {
  legacyRef: string;
  notes: string;
}

function sessionKeyFor(doc: RawDocument, zReports: readonly RawZReport[]): SessionKey {
  const z = zReports.find((r) => doc.id >= r.fromDocumentId && doc.id <= r.toDocumentId);
  if (z) return { legacyRef: `aronium:z:${z.id}`, notes: `Importado de Aronium (cierre Z n.º ${z.number})` };
  const day = localDay(doc.dateCreated);
  return { legacyRef: `aronium:day:${day}`, notes: `Importado de Aronium (sin cierre Z, día ${day})` };
}

function closeSession(key: SessionKey, sales: SaleRecord[]): SessionRecord {
  const times = sales.map((s) => s.createdAtUtc).sort();
  const openedAtUtc = times[0] ?? '';
  const closedAtUtc = times[times.length - 1] ?? openedAtUtc;
  const cashCents = sales.filter((s) => s.paymentMethod === 'efectivo').reduce((sum, s) => sum + s.totalCents, 0);
  return { ...key, openedAtUtc, closedAtUtc, cashCents, sales };
}

/** Un item_id sin slug solo es seguro si el destino comparte ids con el menú del CSV. */
function idOnlyWarnings(map: readonly MapRow[]): string[] {
  return map
    .filter((row) => row.itemId !== null && row.itemSlug === null)
    .map((row) => `legacy_id ${row.legacyId} (${row.legacyName}): item_id sin item_slug, se enlaza por id (solo seguro si el destino usa los mismos ids)`);
}

/** Una fila de legacy_product_map por producto de Aronium; los que faltan en el CSV quedan sin emparejar. */
function completeMapRows(raw: RawData, map: readonly MapRow[]): MapRow[] {
  const mapById = new Map(map.map((row) => [row.legacyId, row]));
  return raw.products.map(
    (product) =>
      mapById.get(product.id) ?? {
        legacyId: product.id,
        legacyName: product.name,
        legacyGroup: product.groupName,
        itemId: null,
        itemSlug: null,
        sizeKey: sizeFromGroup(product.groupName),
        status: 'unmatched' as const,
      },
  );
}

export interface PlanOptions {
  /** Importar solo documentos con día local >= from ('YYYY-MM-DD'). */
  from?: string;
}

/** Pura: de los datos crudos de Aronium al plan de importación, sin tocar disco ni DB. */
export function buildPlan(raw: RawData, map: readonly MapRow[], options: PlanOptions): ImportPlan {
  const warnings: string[] = [];
  warnings.push(...idOnlyWarnings(map));
  const lookups = buildLookups(raw, map, warnings);
  const counters = new Map<string, number>();
  const grouped = new Map<string, { key: SessionKey; sales: SaleRecord[] }>();
  for (const doc of [...raw.documents].sort((a, b) => a.id - b.id)) {
    const key = sessionKeyFor(doc, raw.zReports);
    // La numeración se calcula sobre toda la sesión para no chocar al reimportar con --from.
    const number = (counters.get(key.legacyRef) ?? 0) + 1;
    counters.set(key.legacyRef, number);
    if (options.from && localDay(doc.dateCreated) < options.from) continue;
    const sale = buildSale(doc, number, lookups, warnings);
    if (!sale) continue;
    const entry = grouped.get(key.legacyRef) ?? { key, sales: [] };
    entry.sales.push(sale);
    grouped.set(key.legacyRef, entry);
  }
  const sessions = [...grouped.values()].map((entry) => closeSession(entry.key, entry.sales));
  const sales = sessions.flatMap((s) => s.sales);
  return {
    sessions,
    mapRows: completeMapRows(raw, map),
    warnings,
    salesCount: sales.length,
    itemsCount: sales.reduce((sum, s) => sum + s.items.length, 0),
    totalCents: sales.reduce((sum, s) => sum + s.totalCents, 0),
  };
}
