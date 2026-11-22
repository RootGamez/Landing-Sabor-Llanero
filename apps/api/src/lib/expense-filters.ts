import type { Context } from 'hono';
import { isValidLocalDate } from '@sabor/shared';
import type { AppEnv } from '../env';
import { badRequest } from './http-error';

export interface ExpenseFilters {
  where: string;
  params: Array<string | number>;
}

const PAYMENT_KEY = /^[a-z][a-z0-9_]{0,31}$/;
/** D1 limita los patrones LIKE a 50 bytes: con escapes y tildes, 20 caracteres siempre caben. */
const SEARCH_MAX = 20;

function dateParam(c: Context<AppEnv>, name: 'from' | 'to'): string | undefined {
  const value = c.req.query(name);
  if (value === undefined || value === '') return undefined;
  if (!isValidLocalDate(value)) throw badRequest(`${name} inválido (formato esperado: YYYY-MM-DD)`);
  return value;
}

function categoryParam(c: Context<AppEnv>): number | undefined {
  const raw = c.req.query('category_id');
  if (raw === undefined || raw === '') return undefined;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('category_id inválido');
  return id;
}

/** Escapa `\`, `%` y `_` para que el texto buscado se compare literal en un LIKE con ESCAPE. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

/**
 * Filtros de `GET /api/expenses` (siempre excluye borrados). `category_id` de
 * una categoría padre incluye a sus hijas. Los valores van como parámetros.
 */
export function buildExpenseFilters(c: Context<AppEnv>): ExpenseFilters {
  const from = dateParam(c, 'from');
  const to = dateParam(c, 'to');
  if (from && to && from > to) throw badRequest('from no puede ser posterior a to');
  const categoryId = categoryParam(c);
  const method = c.req.query('payment_method');
  if (method !== undefined && method !== '' && !PAYMENT_KEY.test(method)) {
    throw badRequest('payment_method inválido');
  }
  const q = (c.req.query('q') ?? '').trim().slice(0, SEARCH_MAX);

  const conditions = ['e.deleted_at IS NULL'];
  const params: Array<string | number> = [];
  if (from) {
    conditions.push('e.date >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('e.date <= ?');
    params.push(to);
  }
  if (categoryId !== undefined) {
    conditions.push('(e.category_id = ? OR e.category_id IN (SELECT id FROM expense_categories WHERE parent_id = ?))');
    params.push(categoryId, categoryId);
  }
  if (method) {
    conditions.push('e.payment_method = ?');
    params.push(method);
  }
  if (q) {
    conditions.push("e.description LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(q)}%`);
  }
  return { where: `WHERE ${conditions.join(' AND ')}`, params };
}
