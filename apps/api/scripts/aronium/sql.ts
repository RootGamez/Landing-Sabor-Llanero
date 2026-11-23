import { cleanLegacyName } from './name-clean';
import { sizeFromGroup } from './product-map';
import { SIZE_LABELS } from './transform';
import type { ImportPlan, MapRow, SaleItemRecord, SaleRecord, SessionRecord, SizeKey } from './types';

export interface BatchLimits {
  maxStatements: number;
  maxBytes: number;
}

/** Aptos para `wrangler d1 execute --file` (D1 limita tamaño de sentencia y de archivo). */
export const DEFAULT_BATCH_LIMITS: BatchLimits = { maxStatements: 400, maxBytes: 90_000 };

/** Literal SQL de texto: comillas duplicadas; NUL no cabe en un literal, se rechaza. */
export function sqlString(value: string): string {
  if (value.includes('\0')) throw new Error('Texto con carácter NUL, no se puede escapar');
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNullableString(value: string | null): string {
  return value === null ? 'NULL' : sqlString(value);
}

function sizeIdExpr(sizeKey: SizeKey | null): string {
  return sizeKey === null ? 'NULL' : `(SELECT id FROM sizes WHERE key = ${sqlString(sizeKey)})`;
}

// Prefiere el slug: los ids de menu_items pueden diferir entre bases (local vs producción).
// Si el ítem no existe en el destino el subselect da NULL y no rompe la FK.
function itemIdExpr(itemId: number | null, itemSlug: string | null): string {
  if (itemSlug !== null) return `(SELECT id FROM menu_items WHERE slug = ${sqlString(itemSlug)})`;
  return itemId === null ? 'NULL' : `(SELECT id FROM menu_items WHERE id = ${Math.trunc(itemId)})`;
}

function itemWhere(itemId: number | null, itemSlug: string | null): string {
  return itemSlug !== null ? `slug = ${sqlString(itemSlug)}` : `id = ${Math.trunc(itemId ?? 0)}`;
}

const SIZE_SUFFIX_EXPR = "CASE WHEN instr(name, ' (×') > 0 THEN substr(name, instr(name, ' (×')) ELSE '' END";

/**
 * Nombre unificado: el name_es actual del ítem del menú (sin tamaño); si el ítem
 * no existe en el destino, el nombre legacy limpio. El sufijo (×0,5) va después.
 */
function itemNameBase(itemId: number | null, itemSlug: string | null, fallback: string): string {
  if (itemId === null && itemSlug === null) return sqlString(fallback);
  return `COALESCE((SELECT name_es FROM menu_items WHERE ${itemWhere(itemId, itemSlug)}), ${sqlString(fallback)})`;
}

function itemNameExpr(item: SaleItemRecord): string {
  const base = itemNameBase(item.itemId, item.itemSlug, item.baseName);
  return item.nameSuffix === '' ? base : `(${base} || ${sqlString(item.nameSuffix)})`;
}

function renderMapRow(row: MapRow): string {
  return (
    'INSERT OR IGNORE INTO legacy_product_map (source, legacy_id, legacy_name, legacy_group, item_id, size_id) VALUES ' +
    `('aronium', ${row.legacyId}, ${sqlString(row.legacyName)}, ${sqlString(row.legacyGroup)}, ` +
    `${itemIdExpr(row.itemId, row.itemSlug)}, ${sizeIdExpr(row.sizeKey)});`
  );
}

function renderSession(session: SessionRecord): string {
  return (
    'INSERT OR IGNORE INTO cash_sessions (opened_at, opening_cash_cents, closed_at, counted_cash_cents, ' +
    'expected_cash_cents, notes, source, legacy_ref) VALUES ' +
    `(${sqlString(session.openedAtUtc)}, 0, ${sqlString(session.closedAtUtc)}, ${session.cashCents}, ` +
    `${session.cashCents}, ${sqlString(session.notes)}, 'aronium', ${sqlString(session.legacyRef)});`
  );
}

function renderSale(session: SessionRecord, sale: SaleRecord): string {
  return (
    'INSERT OR IGNORE INTO sales (session_id, number, created_at, subtotal_cents, discount_cents, total_cents, ' +
    'payment_method, source, legacy_ref) VALUES ' +
    `((SELECT id FROM cash_sessions WHERE legacy_ref = ${sqlString(session.legacyRef)}), ${sale.number}, ` +
    `${sqlString(sale.createdAtUtc)}, ${sale.subtotalCents}, ${sale.discountCents}, ${sale.totalCents}, ` +
    `${sqlString(sale.paymentMethod)}, 'aronium', ${sqlString(sale.legacyRef)});`
  );
}

function renderItemValues(item: SaleItemRecord): string {
  return (
    `(${itemIdExpr(item.itemId, item.itemSlug)}, ${sizeIdExpr(item.sizeKey)}, ${itemNameExpr(item)}, ` +
    `${sqlNullableString(item.sizeLabel)}, ${item.unitPriceCents}, ${item.quantity}, ${item.lineTotalCents})`
  );
}

// INSERT plano (no OR IGNORE) para que un CHECK roto falle a la vista; la
// idempotencia la da el NOT EXISTS sobre la venta ya importada.
function renderSaleItems(sale: SaleRecord): string {
  const values = sale.items.map(renderItemValues).join(', ');
  const ref = sqlString(sale.legacyRef);
  return (
    'INSERT INTO sale_items (sale_id, item_id, size_id, name, size_label, unit_price_cents, quantity, line_total_cents) ' +
    'SELECT s.id, v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7 ' +
    `FROM sales s, (VALUES ${values}) AS v ` +
    `WHERE s.legacy_ref = ${ref} AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id);`
  );
}

/** Sentencias en orden de dependencia: mapa, luego por sesión: sesión, ventas, líneas. */
export function renderPlan(plan: ImportPlan): string[] {
  const statements = plan.mapRows.map(renderMapRow);
  for (const session of plan.sessions) {
    statements.push(renderSession(session));
    for (const sale of session.sales) statements.push(renderSale(session, sale), renderSaleItems(sale));
  }
  return statements;
}

/** Agrupa respetando el orden; una sentencia mayor que el límite va sola. */
export function batchStatements(statements: readonly string[], limits: BatchLimits = DEFAULT_BATCH_LIMITS): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let bytes = 0;
  for (const statement of statements) {
    const size = Buffer.byteLength(statement, 'utf8') + 1;
    const full = current.length >= limits.maxStatements || (current.length > 0 && bytes + size > limits.maxBytes);
    if (full) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(statement);
    bytes += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function sizeLabelOf(sizeKey: SizeKey | null): string | null {
  return sizeKey === null ? null : SIZE_LABELS[sizeKey];
}

function labelCondition(label: string | null): string {
  return label === null ? 'size_label IS NULL' : `size_label = ${sqlString(label)}`;
}

function nameMatch(names: readonly string[]): string {
  const conditions = names.map(
    (name) => `name = ${sqlString(name)} OR substr(name, 1, ${name.length + 3}) = ${sqlString(`${name} (×`)}`,
  );
  return conditions.join(' OR ');
}

// Reconoce las líneas del producto por nombre (legacy crudo o limpio, con o sin
// sufijo) y, si ya está vinculado, por item_id; así repetirlo no cambia nada.
function renderRelinkLines(row: MapRow): string {
  const groupLabel = sizeLabelOf(sizeFromGroup(row.legacyGroup));
  const csvLabel = sizeLabelOf(row.sizeKey);
  const hasItem = row.itemId !== null || row.itemSlug !== null;
  const clean = cleanLegacyName(row.legacyName);
  const matches = [nameMatch([...new Set([row.legacyName, clean])])];
  if (hasItem) matches.push(`item_id = ${itemIdExpr(row.itemId, row.itemSlug)}`);
  const labels = [...new Set([groupLabel, csvLabel])].map(labelCondition).join(' OR ');
  const nameSet = `name = ${itemNameBase(row.itemId, row.itemSlug, clean)} || ${SIZE_SUFFIX_EXPR}`;
  const itemSet = hasItem
    ? `item_id = ${itemIdExpr(row.itemId, row.itemSlug)}, size_id = ${sizeIdExpr(row.sizeKey)}, size_label = ${sqlNullableString(csvLabel)}, `
    : '';
  return (
    `UPDATE sale_items SET ${itemSet}${nameSet} ` +
    "WHERE sale_id IN (SELECT id FROM sales WHERE source = 'aronium') " +
    `AND (${matches.join(' OR ')}) AND (${labels});`
  );
}

function renderRelinkMap(row: MapRow): string {
  return (
    `UPDATE legacy_product_map SET item_id = ${itemIdExpr(row.itemId, row.itemSlug)}, size_id = ${sizeIdExpr(row.sizeKey)} ` +
    `WHERE source = 'aronium' AND legacy_id = ${row.legacyId};`
  );
}

/**
 * Corrige ítem, tamaño y nombre de lo YA importado (INSERT OR IGNORE no actualiza).
 * Identifica la línea por el nombre guardado (crudo o limpio), el ítem ya vinculado
 * y el tamaño del grupo de Aronium. Idempotente; no toca importes.
 */
export function renderRelinkSql(rows: readonly MapRow[]): string {
  const body = rows.flatMap((row) => {
    const hasItem = row.itemId !== null || row.itemSlug !== null;
    return hasItem ? [renderRelinkLines(row), renderRelinkMap(row)] : [renderRelinkLines(row)];
  });
  return [
    '-- Re-vincula líneas ya importadas (item, tamaño y nombre unificado) según el CSV. Seguro de repetir.',
    ...body,
    '',
  ].join('\n');
}

export interface VerifyTotals {
  salesCount: number;
  itemsCount: number;
  totalCents: number;
  sessionsCount: number;
}

/** SELECTs de control para correr tras aplicar los lotes; los esperados van en comentarios. */
export function renderVerifySql(expected: VerifyTotals): string {
  return [
    '-- Verificación posterior a la importación de Aronium. Compara cada resultado con "esperado".',
    '',
    `-- esperado: ventas = ${expected.salesCount}, total_cents = ${expected.totalCents}`,
    "SELECT COUNT(*) AS ventas, SUM(total_cents) AS total_cents FROM sales WHERE source = 'aronium';",
    '',
    `-- esperado: sesiones = ${expected.sessionsCount}`,
    "SELECT COUNT(*) AS sesiones FROM cash_sessions WHERE source = 'aronium';",
    '',
    `-- esperado: lineas = ${expected.itemsCount}`,
    'SELECT COUNT(*) AS lineas FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE source = \'aronium\');',
    '',
    '-- esperado: 0 (ninguna venta cuyo subtotal difiera de la suma de sus líneas)',
    "SELECT COUNT(*) AS descuadradas FROM sales s WHERE s.source = 'aronium' AND s.subtotal_cents <> " +
      '(SELECT COALESCE(SUM(line_total_cents), 0) FROM sale_items WHERE sale_id = s.id);',
    '',
    '-- esperado: 0 (ninguna sesión cuyo efectivo esperado difiera de sus ventas en efectivo)',
    "SELECT COUNT(*) AS sesiones_descuadradas FROM cash_sessions c WHERE c.source = 'aronium' AND c.expected_cash_cents <> " +
      "(SELECT COALESCE(SUM(total_cents), 0) FROM sales WHERE session_id = c.id AND payment_method = 'efectivo');",
    '',
    '-- informativo: ventas y total por método de pago',
    "SELECT payment_method, COUNT(*) AS ventas, SUM(total_cents) AS total_cents FROM sales WHERE source = 'aronium' GROUP BY payment_method;",
    '',
  ].join('\n');
}

/**
 * Deshace la importación de Aronium (solo filas con source='aronium'). Orden por
 * las FK: ventas (sus líneas caen por CASCADE), luego sesiones y el mapa.
 */
export function renderRollbackSql(): string {
  return [
    '-- Deshace la importación de Aronium. No toca ventas/sesiones del POS ni de HomeBank.',
    "DELETE FROM sales WHERE source = 'aronium';",
    "DELETE FROM cash_sessions WHERE source = 'aronium';",
    "DELETE FROM legacy_product_map WHERE source = 'aronium';",
    '',
  ].join('\n');
}
