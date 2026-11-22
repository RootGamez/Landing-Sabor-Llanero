import type { CashCloseMethodTotal, CashCloseTopProduct, CashSessionSummary } from '@sabor/shared';
import type { CashSessionRow } from '../db/rows';

/** Clave estable del método que mueve el efectivo físico de la caja (seed de `payment_methods`). */
export const CASH_METHOD_KEY = 'efectivo';
export const TOP_PRODUCTS_LIMIT = 10;

interface MethodRow {
  paymentMethod: string;
  label: string;
  salesCount: number;
  totalCents: number;
}

interface ProductRow {
  name: string;
  sizeLabel: string | null;
  quantity: number;
  totalCents: number;
}

/** Efectivo esperado = apertura + ventas en efectivo − gastos de caja. Nunca negativo (CHECK de la tabla). */
export function expectedCash(openingCents: number, cashSalesCents: number, cashExpensesCents: number): number {
  return Math.max(0, openingCents + cashSalesCents - cashExpensesCents);
}

function productName(row: ProductRow): string {
  return row.sizeLabel ? `${row.name} (${row.sizeLabel})` : row.name;
}

/**
 * Resumen de una sesión (en vivo o base del snapshot de cierre). Solo cuenta
 * ventas no anuladas; los gastos son los `paid_from_register` no borrados de
 * la sesión. Las 4 consultas van en un `batch` (una lectura consistente).
 */
export async function computeSessionSummary(
  db: D1Database,
  session: Pick<CashSessionRow, 'id' | 'opened_at' | 'opening_cash_cents'>,
): Promise<CashSessionSummary> {
  const [methods, voided, products, expenses] = await db.batch([
    db
      .prepare(
        `SELECT s.payment_method AS paymentMethod, COALESCE(pm.label, s.payment_method) AS label,
                COUNT(*) AS salesCount, SUM(s.total_cents) AS totalCents
           FROM sales s LEFT JOIN payment_methods pm ON pm.key = s.payment_method
          WHERE s.session_id = ? AND s.voided_at IS NULL
          GROUP BY s.payment_method
          ORDER BY COALESCE(pm.display_order, 999), s.payment_method`,
      )
      .bind(session.id),
    db
      .prepare('SELECT COUNT(*) AS n FROM sales WHERE session_id = ? AND voided_at IS NOT NULL')
      .bind(session.id),
    db
      .prepare(
        `SELECT si.name AS name, si.size_label AS sizeLabel,
                SUM(si.quantity) AS quantity, SUM(si.line_total_cents) AS totalCents
           FROM sale_items si JOIN sales s ON s.id = si.sale_id
          WHERE s.session_id = ? AND s.voided_at IS NULL
          GROUP BY si.name, si.size_label
          ORDER BY quantity DESC, totalCents DESC, si.name ASC
          LIMIT ?`,
      )
      .bind(session.id, TOP_PRODUCTS_LIMIT),
    db
      .prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expenses
          WHERE session_id = ? AND paid_from_register = 1 AND deleted_at IS NULL`,
      )
      .bind(session.id),
  ]);

  const byMethod = (methods?.results ?? []) as unknown as MethodRow[];
  const cashExpensesCents = (expenses?.results[0] as { total: number } | undefined)?.total ?? 0;
  const cashSalesCents = byMethod.find((m) => m.paymentMethod === CASH_METHOD_KEY)?.totalCents ?? 0;

  return {
    sessionId: session.id,
    openedAt: session.opened_at,
    openingCashCents: session.opening_cash_cents,
    salesCount: byMethod.reduce((sum, m) => sum + m.salesCount, 0),
    voidedCount: (voided?.results[0] as { n: number } | undefined)?.n ?? 0,
    totalSalesCents: byMethod.reduce((sum, m) => sum + m.totalCents, 0),
    byMethod: byMethod.map<CashCloseMethodTotal>((m) => ({ ...m })),
    cashExpensesCents,
    expectedCashCents: expectedCash(session.opening_cash_cents, cashSalesCents, cashExpensesCents),
    topProducts: ((products?.results ?? []) as unknown as ProductRow[]).map<CashCloseTopProduct>((p) => ({
      name: productName(p),
      quantity: p.quantity,
      totalCents: p.totalCents,
    })),
  };
}
