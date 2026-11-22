import type { CashSessionRow } from '../db/rows';
import { conflict } from './http-error';
import { buildCloseSnapshot, expectedForSnapshot } from './session-snapshot';
import { computeSessionSummary } from './session-summary';

const MAX_CLOSE_ATTEMPTS = 3;

export interface CloseInput {
  /** `null` = cierre sin cuadrar (D15): no se guarda esperado ni contado. */
  countedCashCents: number | null;
  notes: string;
  closedBy: number;
}

/** Mismo formato que `datetime('now')` de SQLite (UTC, sin zona). */
function nowSqliteUtc(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Cierra la caja guardando el snapshot. El UPDATE solo aplica si lo recién
 * calculado (nº de ventas, anuladas y gastos de caja) sigue siendo cierto y
 * la sesión sigue abierta; si alguien vendió/anuló/gastó entre el cálculo y
 * el UPDATE, se recalcula (hasta 3 veces). Así el snapshot nunca queda
 * desfasado respecto de las ventas reales y el cierre es atómico.
 */
export async function closeCashSession(
  db: D1Database,
  session: CashSessionRow,
  input: CloseInput,
): Promise<CashSessionRow> {
  const notes = [session.notes, input.notes].filter((part) => part.length > 0).join(' — ');
  for (let attempt = 0; attempt < MAX_CLOSE_ATTEMPTS; attempt += 1) {
    const summary = await computeSessionSummary(db, session);
    const closedAt = nowSqliteUtc();
    const snapshot = buildCloseSnapshot(summary, closedAt, input.countedCashCents);
    const closed = await db
      .prepare(
        `UPDATE cash_sessions
            SET closed_at = ?1, closed_by = ?2, counted_cash_cents = ?3, expected_cash_cents = ?4,
                notes = ?5, close_snapshot_json = ?6
          WHERE id = ?7 AND closed_at IS NULL
            AND (SELECT COUNT(*) FROM sales WHERE session_id = ?7) = ?8
            AND (SELECT COUNT(*) FROM sales WHERE session_id = ?7 AND voided_at IS NOT NULL) = ?9
            AND (SELECT COALESCE(SUM(amount_cents), 0) FROM expenses
                  WHERE session_id = ?7 AND paid_from_register = 1 AND deleted_at IS NULL) = ?10
        RETURNING *`,
      )
      .bind(
        closedAt,
        input.closedBy,
        input.countedCashCents,
        expectedForSnapshot(snapshot),
        notes,
        JSON.stringify(snapshot),
        session.id,
        summary.salesCount + summary.voidedCount,
        summary.voidedCount,
        summary.cashExpensesCents,
      )
      .first<CashSessionRow>();
    if (closed) return closed;

    const current = await db.prepare('SELECT closed_at FROM cash_sessions WHERE id = ?').bind(session.id).first<{ closed_at: string | null }>();
    if (current?.closed_at) throw conflict('La caja ya está cerrada');
  }
  throw conflict('La caja cambió mientras se cerraba, intenta de nuevo');
}
