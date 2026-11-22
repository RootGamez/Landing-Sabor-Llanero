import type { Context } from 'hono';
import type { ExpenseSummary, ExpenseSummaryCategory, ExpenseSummaryItem } from '@sabor/shared';
import type { AppEnv } from '../env';
import type { ExpenseFilters } from './expense-filters';
import { badRequest } from './http-error';

const DEFAULT_ITEMS_LIMIT = 12;
const MAX_ITEMS_LIMIT = 100;

/** `?limit=` de los gastos listados en el resumen (entero 1–100; por defecto 12). */
export function parseSummaryLimit(c: Context<AppEnv>): number {
  const raw = c.req.query('limit');
  if (raw === undefined || raw === '') return DEFAULT_ITEMS_LIMIT;
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ITEMS_LIMIT) {
    throw badRequest(`limit inválido (entero entre 1 y ${MAX_ITEMS_LIMIT})`);
  }
  return limit;
}

/**
 * Resumen de los gastos que cumplen el filtro: total, desglose por categoría
 * raíz (las hijas se suman en su padre) y los `limit` más recientes.
 */
export async function loadExpenseSummary(db: D1Database, filters: ExpenseFilters, limit: number): Promise<ExpenseSummary> {
  const { where, params } = filters;
  // Un solo batch: el total y la lista salen de la misma lectura.
  const [byCategory, items] = await db.batch<ExpenseSummaryCategory | ExpenseSummaryItem>([
    db
      .prepare(
        `SELECT COALESCE(p.id, c.id) AS categoryId, COALESCE(p.name, c.name) AS name,
                COALESCE(p.color, c.color) AS color, SUM(e.amount_cents) AS totalCents, COUNT(*) AS count
           FROM expenses e
           JOIN expense_categories c ON c.id = e.category_id
           LEFT JOIN expense_categories p ON p.id = c.parent_id
          ${where}
          GROUP BY COALESCE(p.id, c.id)
          ORDER BY totalCents DESC, name COLLATE NOCASE ASC`,
      )
      .bind(...params),
    db
      .prepare(
        `SELECT e.id AS id, e.date AS date, e.description AS description, c.name AS categoryName, e.amount_cents AS amountCents
           FROM expenses e JOIN expense_categories c ON c.id = e.category_id
          ${where}
          ORDER BY e.date DESC, e.id DESC LIMIT ?`,
      )
      .bind(...params, limit),
  ]);
  const categories = byCategory!.results as ExpenseSummaryCategory[];
  const latest = items!.results as ExpenseSummaryItem[];
  const count = categories.reduce((sum, row) => sum + row.count, 0);
  const totalCents = categories.reduce((sum, row) => sum + row.totalCents, 0);
  return {
    count,
    totalCents,
    byCategory: categories,
    items: latest,
    moreCount: Math.max(0, count - latest.length),
  };
}
