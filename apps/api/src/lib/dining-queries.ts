/** Filas D1 de mesas/cuentas (0010_dining_tables.sql), su mapeo a DTO y lecturas comunes. */
import type {
  DiningTab,
  DiningTabItem,
  DiningTabStatus,
  DiningTable,
  DiningTableStatus,
  TableShape,
} from '@sabor/shared';
import { parseSaleItemFlavors } from '@sabor/shared';

export interface DiningTableRow {
  id: number;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: TableShape;
  display_order: number;
  is_active: number;
}

export interface DiningTabRow {
  id: number;
  table_id: number;
  client_uuid: string;
  status: DiningTabStatus;
  version: number;
  opened_at: string;
  opened_by: number | null;
  updated_at: string;
  sale_id: number | null;
}

export interface DiningTabItemRow {
  id: number;
  tab_id: number;
  item_id: number | null;
  size_id: number | null;
  name: string;
  size_label: string | null;
  unit_price_cents: number;
  quantity: number;
  /** 0011 (ausentes si la base aún no está migrada). */
  flavors_json?: string | null;
  note?: string | null;
}

/** Fila del mapa: mesa + resumen de su cuenta abierta (LEFT JOIN, columnas `tab_*` null si está libre). */
interface TableStatusRow extends DiningTableRow {
  tab_id: number | null;
  tab_version: number | null;
  tab_opened_at: string | null;
  tab_updated_at: string | null;
  tab_total_cents: number | null;
  tab_item_count: number | null;
}

export const mapDiningTable = (r: DiningTableRow): DiningTable => ({
  id: r.id,
  label: r.label,
  x: r.x,
  y: r.y,
  w: r.w,
  h: r.h,
  shape: r.shape,
  displayOrder: r.display_order,
  isActive: r.is_active === 1,
});

const mapTabItem = (r: DiningTabItemRow): DiningTabItem => ({
  id: r.id,
  itemId: r.item_id,
  sizeId: r.size_id,
  name: r.name,
  sizeLabel: r.size_label,
  unitPriceCents: r.unit_price_cents,
  quantity: r.quantity,
  lineTotalCents: r.unit_price_cents * r.quantity,
  flavors: parseSaleItemFlavors(r.flavors_json),
  note: r.note ?? null,
});

export function mapDiningTab(r: DiningTabRow, items: readonly DiningTabItemRow[]): DiningTab {
  const mapped = items.map(mapTabItem);
  return {
    id: r.id,
    tableId: r.table_id,
    status: r.status,
    version: r.version,
    openedAt: r.opened_at,
    openedBy: r.opened_by,
    updatedAt: r.updated_at,
    saleId: r.sale_id,
    totalCents: mapped.reduce((sum, item) => sum + item.lineTotalCents, 0),
    itemCount: mapped.reduce((sum, item) => sum + item.quantity, 0),
    items: mapped,
  };
}

/** Mapa del local: mesas (activas, o todas para el editor) con el resumen de su cuenta abierta. Una sola consulta. */
export async function listTableStatuses(db: D1Database, includeInactive: boolean): Promise<DiningTableStatus[]> {
  const { results } = await db
    .prepare(
      `SELECT t.*, tab.id AS tab_id, tab.version AS tab_version, tab.opened_at AS tab_opened_at,
              tab.updated_at AS tab_updated_at,
              (SELECT COALESCE(SUM(i.unit_price_cents * i.quantity), 0) FROM dining_tab_items i WHERE i.tab_id = tab.id) AS tab_total_cents,
              (SELECT COALESCE(SUM(i.quantity), 0) FROM dining_tab_items i WHERE i.tab_id = tab.id) AS tab_item_count
         FROM dining_tables t
         LEFT JOIN dining_tabs tab ON tab.table_id = t.id AND tab.status = 'open'
        WHERE (?1 = 1 OR t.is_active = 1)
        ORDER BY t.display_order ASC, t.id ASC`,
    )
    .bind(includeInactive ? 1 : 0)
    .all<TableStatusRow>();
  return results.map((row) => ({
    ...mapDiningTable(row),
    openTab:
      row.tab_id === null
        ? null
        : {
            id: row.tab_id,
            version: row.tab_version ?? 0,
            openedAt: row.tab_opened_at ?? '',
            updatedAt: row.tab_updated_at ?? '',
            totalCents: row.tab_total_cents ?? 0,
            itemCount: row.tab_item_count ?? 0,
          },
  }));
}

export async function findTableRow(db: D1Database, id: number): Promise<DiningTableRow | null> {
  return db.prepare('SELECT * FROM dining_tables WHERE id = ?').bind(id).first<DiningTableRow>();
}

export async function findOpenTabRow(db: D1Database, tableId: number): Promise<DiningTabRow | null> {
  return db
    .prepare("SELECT * FROM dining_tabs WHERE table_id = ? AND status = 'open'")
    .bind(tableId)
    .first<DiningTabRow>();
}

export async function findTabRow(db: D1Database, id: number): Promise<DiningTabRow | null> {
  return db.prepare('SELECT * FROM dining_tabs WHERE id = ?').bind(id).first<DiningTabRow>();
}

export async function loadTabItems(db: D1Database, tabId: number): Promise<DiningTabItemRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM dining_tab_items WHERE tab_id = ? ORDER BY id ASC')
    .bind(tabId)
    .all<DiningTabItemRow>();
  return results;
}

export async function loadTab(db: D1Database, row: DiningTabRow): Promise<DiningTab> {
  return mapDiningTab(row, await loadTabItems(db, row.id));
}
