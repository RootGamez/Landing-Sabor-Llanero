import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { batchStatements, renderPlan } from './sql';
import { buildPlan } from './transform';
import type { MapRow, RawData } from './types';

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../../migrations');

/** SQLite en memoria con las migraciones 0001..0009 aplicadas en orden. */
function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith('.sql')).sort();
  for (const f of files) db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
  return db;
}

const RAW: RawData = {
  products: [
    { id: 1, name: 'Americana', groupName: 'Pizzas Grandes' },
    { id: 2, name: "Pan d'ajo", groupName: 'Entradas' },
  ],
  documents: [
    { id: 1, dateCreated: '2025-04-01 20:00:00.123', total: 35, discount: 0 },
    { id: 2, dateCreated: '2025-04-01 21:00:00', total: 6.5, discount: 0 },
    { id: 3, dateCreated: '2025-04-02 21:00:00', total: 35, discount: 0 },
  ],
  items: [
    { documentId: 1, productId: 1, quantity: 1, price: 35, total: 35 },
    { documentId: 2, productId: 2, quantity: 0.5, price: 13, total: 6.5 },
    { documentId: 3, productId: 1, quantity: 1, price: 35, total: 35 },
  ],
  payments: [{ documentId: 2, typeName: 'Credit Card', amount: 6.5 }],
  zReports: [{ id: 9, number: 1, fromDocumentId: 1, toDocumentId: 2 }],
};

function mapFor(db: DatabaseSync): MapRow[] {
  // Las migraciones no siembran `sizes` (lo hace seed.sql); en producción ya existen.
  db.exec(
    "INSERT INTO sizes (key, label_es, label_en) VALUES ('mediana','Mediana','Medium'), ('grande','Grande','Large'), ('familiar','Familiar','Family')",
  );
  const cat = Number(db.prepare("INSERT INTO categories (slug, name_es) VALUES ('t', 'T')").run().lastInsertRowid);
  const item = Number(
    db.prepare("INSERT INTO menu_items (category_id, slug, name_es) VALUES (?, 'americana-t', 'Americana')").run(cat)
      .lastInsertRowid,
  );
  return [
    { legacyId: 1, legacyName: 'Americana', legacyGroup: 'Pizzas Grandes', itemId: item, sizeKey: 'grande', status: 'auto' },
    { legacyId: 2, legacyName: "Pan d'ajo", legacyGroup: 'Entradas', itemId: null, sizeKey: null, status: 'unmatched' },
  ];
}

function apply(db: DatabaseSync, map: MapRow[]): void {
  for (const batch of batchStatements(renderPlan(buildPlan(RAW, map, {})))) db.exec(batch.join('\n'));
}

function one(db: DatabaseSync, sql: string): Record<string, unknown> {
  return { ...(db.prepare(sql).get() as Record<string, unknown>) };
}

describe('aplicar el SQL generado contra el esquema real (0001..0009)', () => {
  it('inserta todo, respeta los CHECK y los totales cuadran', () => {
    const db = freshDb();
    apply(db, mapFor(db));
    expect(one(db, "SELECT COUNT(*) c, SUM(total_cents) t FROM sales WHERE source = 'aronium'")).toEqual({ c: 3, t: 7650 });
    expect(one(db, 'SELECT COUNT(*) c, SUM(line_total_cents) t FROM sale_items')).toEqual({ c: 3, t: 7650 });
    expect(one(db, 'SELECT COUNT(*) c FROM cash_sessions')).toEqual({ c: 2 });
  });

  it('enlaza item y tamaño por subselect y deja NULL lo no emparejado', () => {
    const db = freshDb();
    apply(db, mapFor(db));
    const rows = db
      .prepare('SELECT name, item_id IS NOT NULL i, size_id IS NOT NULL s, size_label FROM sale_items ORDER BY id')
      .all()
      .map((r) => ({ ...r }));
    expect(rows).toEqual([
      { name: 'Americana', i: 1, s: 1, size_label: 'Grande' },
      { name: "Pan d'ajo (×0,5)", i: 0, s: 0, size_label: null },
      { name: 'Americana', i: 1, s: 1, size_label: 'Grande' },
    ]);
  });

  it('es idempotente: aplicar dos veces no duplica nada', () => {
    const db = freshDb();
    const map = mapFor(db);
    apply(db, map);
    apply(db, map);
    expect(one(db, 'SELECT COUNT(*) c FROM sales')).toEqual({ c: 3 });
    expect(one(db, 'SELECT COUNT(*) c FROM sale_items')).toEqual({ c: 3 });
    expect(one(db, 'SELECT COUNT(*) c FROM cash_sessions')).toEqual({ c: 2 });
    expect(one(db, 'SELECT COUNT(*) c FROM legacy_product_map')).toEqual({ c: 2 });
  });

  it('las sesiones quedan cerradas con efectivo esperado = contado', () => {
    const db = freshDb();
    apply(db, mapFor(db));
    const sql = "SELECT closed_at IS NOT NULL closed, expected_cash_cents e, counted_cash_cents c FROM cash_sessions WHERE legacy_ref = 'aronium:z:9'";
    expect(one(db, sql)).toEqual({ closed: 1, e: 3500, c: 3500 });
  });
});
