import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { batchStatements, renderPlan, renderRelinkSql } from './sql';
import { buildPlan } from './transform';
import type { MapRow, RawData } from './types';

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../../migrations');

const RAW: RawData = {
  products: [
    { id: 1, name: 'Americana', groupName: 'Pizzas Grandes' },
    { id: 2, name: 'Tequeños', groupName: 'Entradas' },
    { id: 3, name: 'Chicha', groupName: 'Bebidas' },
  ],
  documents: [
    { id: 1, dateCreated: '2025-04-01 20:00:00', total: 60, discount: 0 },
    { id: 2, dateCreated: '2025-04-01 21:00:00', total: 5, discount: 0 },
  ],
  items: [
    { documentId: 1, productId: 1, quantity: 1, price: 35, total: 35 },
    { documentId: 1, productId: 2, quantity: 1, price: 10, total: 10 },
    { documentId: 1, productId: 3, quantity: 1, price: 15, total: 15 },
    { documentId: 2, productId: 3, quantity: 1, price: 5, total: 5 },
  ],
  payments: [],
  zReports: [],
};

/** Sin itemId a propósito: el destino puede tener otros ids para los mismos slugs. */
const MAP: MapRow[] = [
  { legacyId: 1, legacyName: 'Americana', legacyGroup: 'Pizzas Grandes', itemId: 11, itemSlug: 'americana', sizeKey: 'grande', status: 'auto' },
  { legacyId: 2, legacyName: 'Tequeños', legacyGroup: 'Entradas', itemId: 2, itemSlug: 'tequenos', sizeKey: null, status: 'auto' },
  { legacyId: 3, legacyName: 'Chicha', legacyGroup: 'Bebidas', itemId: 5, itemSlug: 'slug-que-no-existe', sizeKey: null, status: 'auto' },
];

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith('.sql')).sort();
  for (const f of files) db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
  db.exec("INSERT INTO sizes (key, label_es, label_en) VALUES ('grande','Grande','Large'), ('mediana','Mediana','M'), ('familiar','Familiar','F')");
  db.exec("INSERT INTO categories (slug, name_es) VALUES ('t', 'T')");
  return db;
}

/** Ids barajados: 'americana' vive en id 2 y 'tequenos' en id 11, al revés que el CSV. */
function seedShuffledMenu(db: DatabaseSync): void {
  const insert = db.prepare('INSERT INTO menu_items (id, category_id, slug, name_es) VALUES (?, 1, ?, ?)');
  insert.run(2, 'americana', 'Americana');
  insert.run(11, 'tequenos', 'Tequeños');
  insert.run(5, 'otro-item', 'Otro');
}

function apply(db: DatabaseSync, map: MapRow[]): void {
  for (const batch of batchStatements(renderPlan(buildPlan(RAW, map, {})))) db.exec(batch.join('\n'));
}

function names(db: DatabaseSync): Record<string, string | null> {
  const rows = db
    .prepare('SELECT si.name n, mi.slug s FROM sale_items si LEFT JOIN menu_items mi ON mi.id = si.item_id ORDER BY si.id')
    .all() as { n: string; s: string | null }[];
  return Object.fromEntries(rows.map((r) => [r.n, r.s]));
}

describe('resolución por slug (ids distintos entre local y producción)', () => {
  it('enlaza cada línea al ítem con ese slug aunque los ids estén barajados', () => {
    const db = freshDb();
    seedShuffledMenu(db);
    apply(db, MAP);
    expect(names(db)).toMatchObject({ Americana: 'americana', Tequeños: 'tequenos' });
  });

  it('un slug inexistente deja item_id en NULL sin romper la importación', () => {
    const db = freshDb();
    seedShuffledMenu(db);
    apply(db, MAP);
    expect(names(db)['Chicha']).toBeNull();
    expect(db.prepare('SELECT COUNT(*) c FROM sales').get()).toMatchObject({ c: 2 });
  });

  it('con slug, el id del CSV se ignora: id 11 del CSV no arrastra "Tequeños" a "Americana"', () => {
    const db = freshDb();
    seedShuffledMenu(db);
    apply(db, MAP);
    const americana = db.prepare("SELECT item_id i FROM sale_items WHERE name = 'Americana'").get() as { i: number };
    expect(americana.i).toBe(2);
  });

  it('el SQL generado con slug no contiene `menu_items WHERE id =`', () => {
    const sql = renderPlan(buildPlan(RAW, MAP, {})).join('\n');
    expect(sql).not.toContain('FROM menu_items WHERE id =');
    expect(sql).toContain("FROM menu_items WHERE slug = 'americana'");
  });

  it('relink-items.sql también resuelve por slug', () => {
    const db = freshDb();
    seedShuffledMenu(db);
    apply(db, MAP.map((r) => ({ ...r, itemId: null, itemSlug: null, status: 'unmatched' as const })));
    db.exec(renderRelinkSql(MAP));
    expect(names(db)).toMatchObject({ Americana: 'americana', Tequeños: 'tequenos' });
  });

  it('un CSV viejo (solo item_id) sigue funcionando por id y avisa', () => {
    const legacy = MAP.map((r) => ({ ...r, itemSlug: null }));
    const plan = buildPlan(RAW, legacy, {});
    expect(plan.warnings.join('\n')).toMatch(/item_id sin item_slug/);
    expect(renderPlan(plan).join('\n')).toContain('FROM menu_items WHERE id = 11');
  });
});
