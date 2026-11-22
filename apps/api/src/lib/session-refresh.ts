import { isReconciledSnapshot, type CashCloseSnapshot } from '@sabor/shared';
import type { CashSessionRow } from '../db/rows';
import { buildCloseSnapshot, expectedForSnapshot } from './session-snapshot';
import { computeSessionSummary } from './session-summary';

/**
 * Conteo a conservar al re-fotografiar: `null` si el cierre original no se
 * cuadró (D15); el contado guardado si sí; `undefined` si no hay nada que
 * refrescar (snapshot viejo/importado sin conteo).
 */
function countedToKeep(session: CashSessionRow, previous: CashCloseSnapshot): number | null | undefined {
  if (!isReconciledSnapshot(previous)) return null;
  return session.counted_cash_cents ?? undefined;
}

/**
 * Re-fotografía una caja YA cerrada después de una corrección posterior
 * (venta anulada por el owner, gasto de caja editado/eliminado). Recalcula
 * resumen y esperado en vivo y reescribe `close_snapshot_json` y
 * `expected_cash_cents`; `counted_cash_cents`, `closed_at` y notas quedan
 * intactos, así la diferencia refleja la corrección. Una caja cerrada sin
 * cuadrar sigue sin cuadrar: el snapshot conserva `reconciled: false` y no
 * calcula esperado ni diferencia. No hace nada con cajas abiertas ni con
 * sesiones históricas importadas (sin snapshot o sin conteo).
 */
export async function refreshClosedSessionSnapshot(db: D1Database, sessionId: number): Promise<void> {
  const session = await db.prepare('SELECT * FROM cash_sessions WHERE id = ?').bind(sessionId).first<CashSessionRow>();
  if (!session || !session.closed_at || !session.close_snapshot_json) return;

  const counted = countedToKeep(session, JSON.parse(session.close_snapshot_json) as CashCloseSnapshot);
  if (counted === undefined) return;

  const summary = await computeSessionSummary(db, session);
  const snapshot = buildCloseSnapshot(summary, session.closed_at, counted);
  await db
    .prepare(
      'UPDATE cash_sessions SET close_snapshot_json = ?, expected_cash_cents = ? WHERE id = ? AND closed_at IS NOT NULL',
    )
    .bind(JSON.stringify(snapshot), expectedForSnapshot(snapshot), sessionId)
    .run();
}
