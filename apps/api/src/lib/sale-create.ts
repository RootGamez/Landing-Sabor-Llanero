import { conflict } from './http-error';
import { sumLines, type SaleLine } from './sale-pricing';

export interface NewSale {
  sessionId: number;
  createdBy: number;
  paymentMethod: string;
  discountCents: number;
  cashReceivedCents: number | null;
  orderId: number | null;
  clientUuid: string;
  lines: readonly SaleLine[];
  /**
   * Condición extra (SQL interno, NUNCA texto del cliente; los valores van
   * bindeados) para que la venta nazca: la usa el cobro de mesas para exigir
   * que la cuenta siga abierta y en la versión vista, dentro del mismo INSERT.
   */
  guard?: { sql: string; params: ReadonlyArray<string | number> };
  /** Sentencias que corren en la MISMA transacción, después de la venta y sus líneas. */
  after?: readonly D1PreparedStatement[];
}

/**
 * - `created`: venta + líneas guardadas.
 * - `session_closed`: la caja se cerró entre la lectura y el INSERT; no se guardó nada.
 * - `duplicate`: otra petición con el mismo `clientUuid` ganó la carrera (idempotencia).
 */
export type InsertSaleResult = 'created' | 'session_closed' | 'duplicate';

const MAX_NUMBER_RETRIES = 4;

function errorText(err: unknown): string {
  if (!(err instanceof Error)) return '';
  const cause = err.cause instanceof Error ? err.cause.message : '';
  return `${err.message} ${cause}`;
}

/** Columnas opcionales de `sale_items` (sabores en JSON + nota) para el INSERT de una línea. */
export function lineExtras(line: SaleLine): { columns: string; placeholders: string; values: Array<string | null> } {
  const flavors = line.flavors ? JSON.stringify(line.flavors) : null;
  const note = line.note ?? null;
  if (flavors === null && note === null) return { columns: '', placeholders: '', values: [] };
  return { columns: ', flavors_json, note', placeholders: ', ?, ?', values: [flavors, note] };
}

function buildStatements(db: D1Database, sale: NewSale): D1PreparedStatement[] {
  const subtotal = sumLines(sale.lines);
  // La venta nace solo si la sesión sigue abierta (mismo statement: sin ventana
  // de carrera con el cierre) y toma el siguiente correlativo de esa sesión.
  const insertSale = db
    .prepare(
      `INSERT INTO sales
         (session_id, number, created_by, subtotal_cents, discount_cents, total_cents,
          payment_method, cash_received_cents, order_id, client_uuid)
       SELECT cs.id, COALESCE((SELECT MAX(number) FROM sales WHERE session_id = cs.id), 0) + 1,
              ?, ?, ?, ?, ?, ?, ?, ?
         FROM cash_sessions cs
        WHERE cs.id = ? AND cs.closed_at IS NULL${sale.guard ? ` AND ${sale.guard.sql}` : ''}`,
    )
    .bind(
      sale.createdBy,
      subtotal,
      sale.discountCents,
      subtotal - sale.discountCents,
      sale.paymentMethod,
      sale.cashReceivedCents,
      sale.orderId,
      sale.clientUuid,
      sale.sessionId,
      ...(sale.guard?.params ?? []),
    );
  // Las líneas se enlazan por client_uuid (UNIQUE) y solo si la sesión sigue
  // abierta: si la venta no se creó (caja cerrada) o ya existía de antes, no
  // se inserta nada, así un reintento nunca duplica líneas.
  // Sabores/nota (0011) solo se nombran si la línea los trae: una venta simple
  // sigue funcionando aunque la base todavía no tenga la migración aplicada.
  const insertLines = sale.lines.map((line) => {
    const extras = lineExtras(line);
    return db
      .prepare(
        `INSERT INTO sale_items
           (sale_id, item_id, size_id, name, size_label, unit_price_cents, quantity, line_total_cents${extras.columns})
         SELECT s.id, ?, ?, ?, ?, ?, ?, ?${extras.placeholders}
           FROM sales s JOIN cash_sessions cs ON cs.id = s.session_id
          WHERE s.client_uuid = ? AND cs.closed_at IS NULL`,
      )
      .bind(
        line.itemId,
        line.sizeId,
        line.name,
        line.sizeLabel,
        line.unitPriceCents,
        line.quantity,
        line.unitPriceCents * line.quantity,
        ...extras.values,
        sale.clientUuid,
      );
  });
  return [insertSale, ...insertLines, ...(sale.after ?? [])];
}

/**
 * Crea la venta y sus líneas de forma atómica (`DB.batch` = una transacción).
 * Reintenta si dos ventas simultáneas chocan por el correlativo; traduce las
 * violaciones UNIQUE de `client_uuid` y `order_id` a resultados explícitos.
 */
export async function insertSale(db: D1Database, sale: NewSale): Promise<InsertSaleResult> {
  for (let attempt = 0; attempt < MAX_NUMBER_RETRIES; attempt += 1) {
    try {
      const results = await db.batch(buildStatements(db, sale));
      return results[0]?.meta.changes === 0 ? 'session_closed' : 'created';
    } catch (err) {
      const text = errorText(err);
      if (text.includes('sales.client_uuid')) return 'duplicate';
      if (text.includes('sales.order_id')) throw conflict('Ese pedido ya fue cobrado');
      if (!text.includes('sales.session_id, sales.number')) throw err;
    }
  }
  throw conflict('No se pudo asignar el número de la venta, intenta de nuevo');
}
