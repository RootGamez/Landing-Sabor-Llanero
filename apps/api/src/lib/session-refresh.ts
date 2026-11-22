import type { CashCloseSnapshot } from '@sabor/shared';
import type { CashSessionRow } from '../db/rows';
import { computeSessionSummary } from './session-summary';

/**
 * Re-fotografía una caja YA cerrada después de una corrección posterior
 * (venta anulada por el owner, gasto de caja editado/eliminado). Recalcula
 * resumen y esperado en vivo y reescribe `close_snapshot_json` y
 * `expected_cash_cents`; `counted_cash_cents`, `closed_at` y notas quedan
 * intactos, así la diferencia refleja la corrección. No hace nada con cajas
 * abiertas ni con sesiones históricas importadas (sin snapshot o sin conteo).
 */
export async function refreshClosedSessionSnapshot(db: D1Database, sessionId: number): Promise<void> {
  const session = await db.prepare('SELECT * FROM cash_sessions WHERE id = ?').bind(sessionId).first<CashSessionRow>();
  if (!session || !session.closed_at || session.counted_cash_cents === null || !session.close_snapshot_json) return;

  const summary = await computeSessionSummary(db, session);
  const snapshot: CashCloseSnapshot = {
    ...summary,
    closedAt: session.closed_at,
    countedCashCents: session.counted_cash_cents,
    differenceCents: session.counted_cash_cents - summary.expectedCashCents,
  };
  await db
    .prepare(
      'UPDATE cash_sessions SET close_snapshot_json = ?, expected_cash_cents = ? WHERE id = ? AND closed_at IS NOT NULL',
    )
    .bind(JSON.stringify(snapshot), summary.expectedCashCents, sessionId)
    .run();
}
