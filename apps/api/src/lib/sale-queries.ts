import type { Sale } from '@sabor/shared';
import { mapSale, mapSaleItem, type CashSessionRow, type SaleItemRow, type SaleRow } from '../db/rows';

/** Caja abierta actual (a lo sumo una: índice único parcial en la DB). */
export async function findOpenSession(db: D1Database): Promise<CashSessionRow | null> {
  return db.prepare('SELECT * FROM cash_sessions WHERE closed_at IS NULL LIMIT 1').first<CashSessionRow>();
}

/** Anti-N+1: carga las líneas de varias ventas en un solo SELECT y arma los DTO. */
export async function hydrateSales(db: D1Database, rows: readonly SaleRow[]): Promise<Sale[]> {
  if (rows.length === 0) return [];
  const { results } = await db
    .prepare(`SELECT * FROM sale_items WHERE sale_id IN (${rows.map(() => '?').join(',')}) ORDER BY id ASC`)
    .bind(...rows.map((row) => row.id))
    .all<SaleItemRow>();
  const bySale = new Map<number, SaleItemRow[]>();
  for (const item of results) bySale.set(item.sale_id, [...(bySale.get(item.sale_id) ?? []), item]);
  return rows.map((row) => mapSale(row, (bySale.get(row.id) ?? []).map(mapSaleItem)));
}

export async function findSaleRow(db: D1Database, id: number): Promise<SaleRow | null> {
  return db.prepare('SELECT * FROM sales WHERE id = ?').bind(id).first<SaleRow>();
}

export async function findSaleRowByUuid(db: D1Database, clientUuid: string): Promise<SaleRow | null> {
  return db.prepare('SELECT * FROM sales WHERE client_uuid = ?').bind(clientUuid).first<SaleRow>();
}
