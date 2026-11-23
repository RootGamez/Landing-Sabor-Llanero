import type { Sale, SaleTable } from '@sabor/shared';
import {
  mapSale,
  mapSaleItem,
  mapSaleTable,
  type CashSessionRow,
  type SaleItemRow,
  type SaleRow,
  type SaleTableRow,
} from '../db/rows';

/** Caja abierta actual (a lo sumo una: índice único parcial en la DB). */
export async function findOpenSession(db: D1Database): Promise<CashSessionRow | null> {
  return db.prepare('SELECT * FROM cash_sessions WHERE closed_at IS NULL LIMIT 1').first<CashSessionRow>();
}

/** D1 admite como máximo 100 variables enlazadas (`?`) por consulta. */
export const D1_MAX_BOUND_VARIABLES = 100;
/**
 * Ids por `IN (?, ...)` en la hidratación: 90, con margen bajo el tope de D1.
 * Una página normal (`PAGE_SIZE_MAX` = 100 como máximo, ver params.ts) cabe en
 * 2 consultas hasta 90 ventas y en 4 con 91-100; nunca se supera el tope de D1.
 */
export const HYDRATE_CHUNK_SIZE = 90;

/** Parte la lista en lotes de a lo sumo `size` elementos (sin mutar la original). */
export function chunkIds(ids: readonly number[], size: number = HYDRATE_CHUNK_SIZE): number[][] {
  const chunks: number[][] = [];
  for (let start = 0; start < ids.length; start += size) chunks.push(ids.slice(start, start + size));
  return chunks;
}

/** Líneas de un lote de ventas (a lo sumo `HYDRATE_CHUNK_SIZE` ids), ordenadas por id. */
async function loadItemChunk(db: D1Database, saleIds: readonly number[]): Promise<SaleItemRow[]> {
  const { results } = await db
    .prepare(`SELECT * FROM sale_items WHERE sale_id IN (${saleIds.map(() => '?').join(',')}) ORDER BY id ASC`)
    .bind(...saleIds)
    .all<SaleItemRow>();
  return results;
}

async function loadItemsBySale(db: D1Database, saleIds: readonly number[]): Promise<Map<number, SaleItemRow[]>> {
  const chunks = await Promise.all(chunkIds(saleIds).map((ids) => loadItemChunk(db, ids)));
  const bySale = new Map<number, SaleItemRow[]>();
  for (const item of chunks.flat()) bySale.set(item.sale_id, [...(bySale.get(item.sale_id) ?? []), item]);
  return bySale;
}

/** Mesa de origen por venta: solo las ventas cobradas desde una cuenta de mesa tienen fila acá. */
async function loadTableChunk(db: D1Database, saleIds: readonly number[]): Promise<SaleTableRow[]> {
  const { results } = await db
    .prepare(
      `SELECT dt.sale_id AS sale_id, dt.id AS tab_id, t.label AS table_label, dt.opened_at AS opened_at
         FROM dining_tabs dt JOIN dining_tables t ON t.id = dt.table_id
        WHERE dt.sale_id IN (${saleIds.map(() => '?').join(',')})`,
    )
    .bind(...saleIds)
    .all<SaleTableRow>();
  return results;
}

async function loadTablesBySale(db: D1Database, saleIds: readonly number[]): Promise<Map<number, SaleTable>> {
  const chunks = await Promise.all(chunkIds(saleIds).map((ids) => loadTableChunk(db, ids)));
  return new Map(chunks.flat().map((row) => [row.sale_id, mapSaleTable(row)]));
}

/**
 * Anti-N+1: carga las líneas y la mesa de varias ventas (un SELECT cada una por
 * lote de `HYDRATE_CHUNK_SIZE` ids: 2 consultas en total hasta 90 ventas) y arma los DTO.
 */
export async function hydrateSales(db: D1Database, rows: readonly SaleRow[]): Promise<Sale[]> {
  if (rows.length === 0) return [];
  const saleIds = rows.map((row) => row.id);
  const [itemsBySale, tableBySale] = await Promise.all([
    loadItemsBySale(db, saleIds),
    loadTablesBySale(db, saleIds),
  ]);
  return rows.map((row) =>
    mapSale(row, (itemsBySale.get(row.id) ?? []).map(mapSaleItem), tableBySale.get(row.id) ?? null),
  );
}

export async function findSaleRow(db: D1Database, id: number): Promise<SaleRow | null> {
  return db.prepare('SELECT * FROM sales WHERE id = ?').bind(id).first<SaleRow>();
}

export async function findSaleRowByUuid(db: D1Database, clientUuid: string): Promise<SaleRow | null> {
  return db.prepare('SELECT * FROM sales WHERE client_uuid = ?').bind(clientUuid).first<SaleRow>();
}
