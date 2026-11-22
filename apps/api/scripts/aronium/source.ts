import { DatabaseSync } from 'node:sqlite';
import type { RawData } from './types';

/** DocumentTypeId de ventas en Aronium (en el pos.db de diseño son los 2 392 documentos). */
export const SALES_DOCUMENT_TYPE_ID = 2;

/** Abre el pos.db SOLO lectura; nunca se escribe en él. */
export function openPosDb(path: string): DatabaseSync {
  return new DatabaseSync(path, { readOnly: true });
}

function all<T>(db: DatabaseSync, sql: string, ...params: number[]): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

export function readRawData(db: DatabaseSync): RawData {
  return {
    products: all(
      db,
      `SELECT p.Id AS id, p.Name AS name, COALESCE(g.Name, '') AS groupName
         FROM Product p LEFT JOIN ProductGroup g ON g.Id = p.ProductGroupId ORDER BY p.Id`,
    ),
    documents: all(
      db,
      `SELECT Id AS id, DateCreated AS dateCreated, Total AS total, Discount AS discount
         FROM Document WHERE DocumentTypeId = ? ORDER BY Id`,
      SALES_DOCUMENT_TYPE_ID,
    ),
    items: all(
      db,
      `SELECT i.DocumentId AS documentId, i.ProductId AS productId, i.Quantity AS quantity,
              i.Price AS price, i.Total AS total
         FROM DocumentItem i JOIN Document d ON d.Id = i.DocumentId
        WHERE d.DocumentTypeId = ? ORDER BY i.Id`,
      SALES_DOCUMENT_TYPE_ID,
    ),
    payments: all(
      db,
      `SELECT p.DocumentId AS documentId, COALESCE(t.Name, '') AS typeName, p.Amount AS amount
         FROM Payment p LEFT JOIN PaymentType t ON t.Id = p.PaymentTypeId ORDER BY p.Id`,
    ),
    zReports: all(
      db,
      `SELECT Id AS id, Number AS number, FromDocumentId AS fromDocumentId, ToDocumentId AS toDocumentId
         FROM ZReport ORDER BY Id`,
    ),
  };
}

export interface InspectStats {
  counts: Record<string, number>;
  dateRange: { first: string | null; last: string | null };
  totalsByDocumentType: { name: string; documents: number; total: number }[];
  paymentMethods: { name: string; payments: number; amount: number }[];
  fractionalLines: number;
  zReports: number;
}

function count(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as unknown as { c: number };
  return row.c;
}

/** Reporte de lectura para `inspect`: no depende de que existan todas las tablas opcionales. */
export function collectInspectStats(db: DatabaseSync): InspectStats {
  const tables = ['Document', 'DocumentItem', 'Payment', 'ZReport', 'Product', 'ProductGroup'];
  const range = db.prepare('SELECT MIN(DateCreated) AS first, MAX(DateCreated) AS last FROM Document').get() as unknown as InspectStats['dateRange'];
  const fractional = db.prepare('SELECT COUNT(*) AS c FROM DocumentItem WHERE Quantity <> CAST(Quantity AS INTEGER)').get() as unknown as { c: number };
  return {
    counts: Object.fromEntries(tables.map((t) => [t, count(db, t)])),
    dateRange: range,
    totalsByDocumentType: all(
      db,
      `SELECT COALESCE(t.Name, 'Tipo ' || d.DocumentTypeId) AS name, COUNT(*) AS documents, SUM(d.Total) AS total
         FROM Document d LEFT JOIN DocumentType t ON t.Id = d.DocumentTypeId GROUP BY d.DocumentTypeId ORDER BY d.DocumentTypeId`,
    ),
    paymentMethods: all(
      db,
      `SELECT COALESCE(t.Name, 'Tipo ' || p.PaymentTypeId) AS name, COUNT(*) AS payments, SUM(p.Amount) AS amount
         FROM Payment p LEFT JOIN PaymentType t ON t.Id = p.PaymentTypeId GROUP BY p.PaymentTypeId ORDER BY p.PaymentTypeId`,
    ),
    fractionalLines: fractional.c,
    zReports: count(db, 'ZReport'),
  };
}
