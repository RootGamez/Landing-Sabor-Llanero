import type { ExpenseInput } from '@sabor/shared';
import type { ExpenseCategoryRow } from '../db/rows';
import { badRequest } from './http-error';
import { CASH_METHOD_KEY } from './session-summary';

/** La categoría debe existir y estar activa para recibir gastos nuevos o reasignados. */
export async function assertCategoryActive(db: D1Database, id: number): Promise<void> {
  const row = await db
    .prepare('SELECT * FROM expense_categories WHERE id = ?')
    .bind(id)
    .first<ExpenseCategoryRow>();
  if (!row) throw badRequest('La categoría no existe');
  if (!row.is_active) throw badRequest('La categoría está desactivada');
  if (row.parent_id !== null) {
    const parent = await db
      .prepare('SELECT is_active FROM expense_categories WHERE id = ?')
      .bind(row.parent_id)
      .first<{ is_active: number }>();
    if (!parent?.is_active) throw badRequest('La categoría principal está desactivada');
  }
}

/** "Pagado de caja" solo tiene sentido con efectivo (descuenta del efectivo esperado). */
export function assertCashRegisterMethod(
  next: Pick<ExpenseInput, 'paidFromRegister' | 'paymentMethod'>,
): void {
  if (next.paidFromRegister && next.paymentMethod !== CASH_METHOD_KEY) {
    throw badRequest('Un gasto pagado de caja debe ser en efectivo');
  }
}
