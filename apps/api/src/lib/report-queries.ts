import type { ReportRange } from '@sabor/shared';
import { utcWindow } from './report-range';

/**
 * Consultas de los reportes del dashboard. Reglas comunes:
 *  - ventas = `voided_at IS NULL`, ventana UTC semiabierta sobre `created_at`
 *    (usa `idx_sales_created`); el día/hora local sale de `-5 hours` (D2).
 *  - gastos = `deleted_at IS NULL`, `date` ya es día local (usa `idx_expenses_date`).
 *  - las ventas `source='homebank'` son un resumen diario fechado a mediodía:
 *    cuentan como ingreso pero no como ticket, producto, hora ni método de pago.
 */

const LIMA_SHIFT = "'-5 hours'";
const SALES_WINDOW = 's.voided_at IS NULL AND s.created_at >= ? AND s.created_at < ?';
const REAL_SALES = `${SALES_WINDOW} AND s.source != 'homebank'`;

/** Expresiones SQL de la hora (0-23) y el día de semana (0 = domingo) en Lima. */
export const HOUR_KEY = `CAST(strftime('%H', s.created_at, ${LIMA_SHIFT}) AS INTEGER)`;
export const WEEKDAY_KEY = `CAST(strftime('%w', s.created_at, ${LIMA_SHIFT}) AS INTEGER)`;

/** Una sola pasada: ingresos totales, solo tickets reales y resumen importado. */
export function salesTotalsStatement(db: D1Database, range: ReportRange): D1PreparedStatement {
  const { fromUtc, toUtc } = utcWindow(range);
  return db
    .prepare(
      `SELECT COALESCE(SUM(s.total_cents), 0) AS incomeCents,
              COALESCE(SUM(CASE WHEN s.source != 'homebank' THEN s.total_cents END), 0) AS ticketIncomeCents,
              COUNT(CASE WHEN s.source != 'homebank' THEN 1 END) AS tickets,
              COALESCE(SUM(CASE WHEN s.source = 'homebank' THEN s.total_cents END), 0) AS summaryIncomeCents
         FROM sales s WHERE ${SALES_WINDOW}`,
    )
    .bind(fromUtc, toUtc);
}

export function expensesTotalStatement(db: D1Database, range: ReportRange): D1PreparedStatement {
  return db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expenses
        WHERE deleted_at IS NULL AND date >= ? AND date <= ?`,
    )
    .bind(range.from, range.to);
}

export function incomeByDayStatement(db: D1Database, range: ReportRange): D1PreparedStatement {
  const { fromUtc, toUtc } = utcWindow(range);
  return db
    .prepare(
      `SELECT date(s.created_at, ${LIMA_SHIFT}) AS day, SUM(s.total_cents) AS cents
         FROM sales s WHERE ${SALES_WINDOW} GROUP BY day`,
    )
    .bind(fromUtc, toUtc);
}

export function expensesByDayStatement(db: D1Database, range: ReportRange): D1PreparedStatement {
  return db
    .prepare(
      `SELECT date AS day, SUM(amount_cents) AS cents FROM expenses
        WHERE deleted_at IS NULL AND date >= ? AND date <= ? GROUP BY date`,
    )
    .bind(range.from, range.to);
}

export function topProductsStatement(
  db: D1Database,
  range: ReportRange,
  orderBy: 'quantity' | 'amount',
  limit: number,
): D1PreparedStatement {
  const { fromUtc, toUtc } = utcWindow(range);
  const order =
    orderBy === 'quantity'
      ? 'quantity DESC, totalCents DESC, si.name ASC'
      : 'totalCents DESC, quantity DESC, si.name ASC';
  return db
    .prepare(
      `SELECT si.name AS name, si.size_label AS sizeLabel,
              SUM(si.quantity) AS quantity, SUM(si.line_total_cents) AS totalCents
         FROM sale_items si JOIN sales s ON s.id = si.sale_id
        WHERE ${REAL_SALES}
        GROUP BY si.name, si.size_label
        ORDER BY ${order}
        LIMIT ?`,
    )
    .bind(fromUtc, toUtc, limit);
}

/** Ventas reales agrupadas por una expresión de hora/día local (`HOUR_KEY`/`WEEKDAY_KEY`). */
export function salesByKeyStatement(
  db: D1Database,
  range: ReportRange,
  keyExpr: typeof HOUR_KEY | typeof WEEKDAY_KEY,
): D1PreparedStatement {
  const { fromUtc, toUtc } = utcWindow(range);
  return db
    .prepare(
      `SELECT ${keyExpr} AS key, COUNT(*) AS salesCount, SUM(s.total_cents) AS totalCents
         FROM sales s WHERE ${REAL_SALES} GROUP BY key`,
    )
    .bind(fromUtc, toUtc);
}

/** Ingreso de ventas resumen (HomeBank): lo que las distribuciones no pueden mostrar. */
export function summaryIncomeStatement(db: D1Database, range: ReportRange): D1PreparedStatement {
  const { fromUtc, toUtc } = utcWindow(range);
  return db
    .prepare(
      `SELECT COALESCE(SUM(s.total_cents), 0) AS total FROM sales s
        WHERE ${SALES_WINDOW} AND s.source = 'homebank'`,
    )
    .bind(fromUtc, toUtc);
}

export function expensesByCategoryStatement(db: D1Database, range: ReportRange): D1PreparedStatement {
  return db
    .prepare(
      `SELECT c.id AS categoryId, c.name AS name, c.parent_id AS parentId, c.color AS color,
              p.name AS parentName, p.color AS parentColor, SUM(e.amount_cents) AS totalCents
         FROM expenses e
         JOIN expense_categories c ON c.id = e.category_id
         LEFT JOIN expense_categories p ON p.id = c.parent_id
        WHERE e.deleted_at IS NULL AND e.date >= ? AND e.date <= ?
        GROUP BY c.id`,
    )
    .bind(range.from, range.to);
}

export function salesByPaymentStatement(db: D1Database, range: ReportRange): D1PreparedStatement {
  const { fromUtc, toUtc } = utcWindow(range);
  return db
    .prepare(
      `SELECT s.payment_method AS paymentMethod, COALESCE(pm.label, s.payment_method) AS label,
              COUNT(*) AS salesCount, SUM(s.total_cents) AS totalCents
         FROM sales s LEFT JOIN payment_methods pm ON pm.key = s.payment_method
        WHERE ${REAL_SALES}
        GROUP BY s.payment_method
        ORDER BY totalCents DESC, COALESCE(pm.display_order, 999) ASC`,
    )
    .bind(fromUtc, toUtc);
}
