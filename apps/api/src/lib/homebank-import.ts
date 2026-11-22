import { localDayRangeUtc, type HomebankExpenseRowInput, type HomebankIncomeRowInput } from '@sabor/shared';

/** Nombre del único ítem de las ventas resumen importadas. */
export const SUMMARY_ITEM_NAME = 'Venta del día (resumen)';
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const NOON_OFFSET_HOURS = 12;
const SALE_REF_PREFIX = 'homebank:';
const SESSION_REF_PREFIX = 'homebank:day:';

const sqliteUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const utcMs = (sqlite: string): number => Date.parse(`${sqlite.replace(' ', 'T')}Z`);

/** Sesión histórica del día: 00:00 → 23:59 hora Lima, expresado en UTC. */
export function dayWindow(date: string): { openedAt: string; closedAt: string; noonAt: string } {
  const { fromUtc, toUtc } = localDayRangeUtc(date);
  return {
    openedAt: fromUtc,
    closedAt: sqliteUtc(utcMs(toUtc) - MS_PER_MINUTE),
    // Las ventas resumen no tienen hora real: se fechan al mediodía local.
    noonAt: sqliteUtc(utcMs(fromUtc) + NOON_OFFSET_HOURS * MS_PER_HOUR),
  };
}

/** Primera aparición de cada hash; los repetidos dentro del mismo request cuentan como duplicados. */
export function uniqueByHash<T extends { hash: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.hash)) return false;
    seen.add(row.hash);
    return true;
  });
}

/** Hashes ya presentes en `expenses.import_hash` (incluye gastos con borrado lógico). */
export async function findExistingExpenseHashes(db: D1Database, hashes: readonly string[]): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();
  const { results } = await db
    .prepare('SELECT import_hash AS hash FROM expenses WHERE import_hash IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(hashes))
    .all<{ hash: string }>();
  return new Set(results.map((r) => r.hash));
}

/** Hashes de ingresos ya presentes como `sales.legacy_ref = 'homebank:<hash>'`. */
export async function findExistingIncomeHashes(db: D1Database, hashes: readonly string[]): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();
  const { results } = await db
    .prepare(
      `SELECT substr(legacy_ref, ${SALE_REF_PREFIX.length + 1}) AS hash FROM sales
        WHERE legacy_ref IN (SELECT '${SALE_REF_PREFIX}' || value FROM json_each(?))`,
    )
    .bind(JSON.stringify(hashes))
    .all<{ hash: string }>();
  return new Set(results.map((r) => r.hash));
}

/** Último número de venta por fecha en las sesiones homebank ya existentes. */
async function loadLastNumbers(db: D1Database, dates: readonly string[]): Promise<Map<string, number>> {
  const { results } = await db
    .prepare(
      `SELECT substr(cs.legacy_ref, ${SESSION_REF_PREFIX.length + 1}) AS date, COALESCE(MAX(s.number), 0) AS last
         FROM cash_sessions cs LEFT JOIN sales s ON s.session_id = cs.id
        WHERE cs.legacy_ref IN (SELECT '${SESSION_REF_PREFIX}' || value FROM json_each(?))
        GROUP BY cs.id`,
    )
    .bind(JSON.stringify(dates))
    .all<{ date: string; last: number }>();
  return new Map(results.map((r) => [r.date, r.last]));
}

export interface ExpenseInsertRow extends HomebankExpenseRowInput {
  categoryId: number;
}

/**
 * Inserta gastos con un solo statement (json_each): evita el tope de variables
 * de D1 y las N queries. Devuelve cuántos se insertaron de verdad (los hashes
 * ya existentes se ignoran por el UNIQUE de `import_hash`).
 */
export async function insertExpenses(
  db: D1Database,
  rows: readonly ExpenseInsertRow[],
  userId: number,
): Promise<number> {
  if (rows.length === 0) return 0;
  const payload = rows.map((r) => ({
    d: r.date,
    a: r.amountCents,
    c: r.categoryId,
    t: r.description,
    p: r.paymentMethod,
    h: r.hash,
  }));
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO expenses
         (date, amount_cents, category_id, description, payment_method, paid_from_register, source, import_hash, created_by)
       SELECT json_extract(value, '$.d'), json_extract(value, '$.a'), json_extract(value, '$.c'),
              json_extract(value, '$.t'), json_extract(value, '$.p'), 0, 'homebank', json_extract(value, '$.h'), ?2
         FROM json_each(?1)`,
    )
    .bind(JSON.stringify(payload), userId)
    .run();
  return result.meta.changes;
}

/**
 * Ventas resumen: una sesión cerrada por día (homebank, nunca la pos real) y
 * una venta con su ítem por ingreso. Un solo `DB.batch` (atómico). Las filas ya
 * importadas se descartan antes, así `UNIQUE(session_id, number)` y `legacy_ref`
 * nunca ignoran una venta en silencio. Devuelve las insertadas.
 */
export async function insertIncomes(
  db: D1Database,
  incomes: readonly HomebankIncomeRowInput[],
  userId: number,
): Promise<number> {
  const existing = await findExistingIncomeHashes(db, incomes.map((r) => r.hash));
  const fresh = uniqueByHash(incomes).filter((r) => !existing.has(r.hash));
  if (fresh.length === 0) return 0;

  const dates = [...new Set(fresh.map((r) => r.date))];
  const nextNumber = await loadLastNumbers(db, dates);
  const sessions = dates.map((date) => {
    const window = dayWindow(date);
    return { r: `${SESSION_REF_PREFIX}${date}`, o: window.openedAt, c: window.closedAt };
  });
  const sales = fresh.map((row) => {
    const number = (nextNumber.get(row.date) ?? 0) + 1;
    nextNumber.set(row.date, number);
    return { d: row.date, n: number, a: row.amountCents, h: row.hash, t: dayWindow(row.date).noonAt };
  });

  const results = await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO cash_sessions
           (opened_at, opened_by, opening_cash_cents, closed_at, closed_by, counted_cash_cents, expected_cash_cents, notes, source, legacy_ref)
         SELECT json_extract(value, '$.o'), ?2, 0, json_extract(value, '$.c'), ?2, 0, 0,
                'Importado de HomeBank', 'homebank', json_extract(value, '$.r')
           FROM json_each(?1)`,
      )
      .bind(JSON.stringify(sessions), userId),
    db
      .prepare(
        `INSERT INTO sales
           (session_id, number, created_at, created_by, subtotal_cents, total_cents, payment_method, source, legacy_ref)
         SELECT cs.id, json_extract(j.value, '$.n'), json_extract(j.value, '$.t'), ?2,
                json_extract(j.value, '$.a'), json_extract(j.value, '$.a'), 'efectivo', 'homebank',
                '${SALE_REF_PREFIX}' || json_extract(j.value, '$.h')
           FROM json_each(?1) j
           JOIN cash_sessions cs ON cs.legacy_ref = '${SESSION_REF_PREFIX}' || json_extract(j.value, '$.d')`,
      )
      .bind(JSON.stringify(sales), userId),
    db
      .prepare(
        `INSERT INTO sale_items (sale_id, name, unit_price_cents, quantity, line_total_cents)
         SELECT s.id, ?2, s.total_cents, 1, s.total_cents FROM sales s
          WHERE s.legacy_ref IN (SELECT '${SALE_REF_PREFIX}' || value FROM json_each(?1))
            AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id)`,
      )
      .bind(JSON.stringify(fresh.map((r) => r.hash)), SUMMARY_ITEM_NAME),
    db
      .prepare(
        `UPDATE cash_sessions
            SET expected_cash_cents = (SELECT COALESCE(SUM(total_cents), 0) FROM sales WHERE session_id = cash_sessions.id AND voided_at IS NULL),
                counted_cash_cents  = (SELECT COALESCE(SUM(total_cents), 0) FROM sales WHERE session_id = cash_sessions.id AND voided_at IS NULL)
          WHERE legacy_ref IN (SELECT '${SESSION_REF_PREFIX}' || value FROM json_each(?1))`,
      )
      .bind(JSON.stringify(dates)),
  ]);
  return results[1]?.meta.changes ?? 0;
}
