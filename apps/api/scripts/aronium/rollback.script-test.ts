import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { missingSlugs } from './product-map';
import { batchStatements, renderPlan, renderRollbackSql } from './sql';
import { buildPlan } from './transform';
import type { MapRow, MenuEntry, RawData } from './types';

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../../migrations');

const RAW: RawData = {
  products: [{ id: 1, name: 'Americana', groupName: 'Pizzas Grandes' }],
  documents: [
    { id: 1, dateCreated: '2025-04-01 20:00:00', total: 35, discount: 0 },
    { id: 2, dateCreated: '2025-04-02 20:00:00', total: 35, discount: 0 },
  ],
  items: [
    { documentId: 1, productId: 1, quantity: 1, price: 35, total: 35 },
    { documentId: 2, productId: 1, quantity: 1, price: 35, total: 35 },
  ],
  payments: [],
  zReports: [],
};
const MAP: MapRow[] = [
  { legacyId: 1, legacyName: 'Americana', legacyGroup: 'Pizzas Grandes', itemId: null, itemSlug: 'americana', sizeKey: 'grande', status: 'auto' },
];

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of fs.readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith('.sql')).sort()) {
    db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
  }
  db.exec("INSERT INTO sizes (key, label_es, label_en) VALUES ('grande','Grande','G')");
  return db;
}

describe('renderRollbackSql', () => {
  it('borra solo lo importado de Aronium y deja intactas las ventas del POS', () => {
    const db = freshDb();
    db.exec("INSERT INTO cash_sessions (opened_at, closed_at, source) VALUES ('2025-01-01 10:00:00', '2025-01-01 20:00:00', 'pos')");
    db.exec("INSERT INTO sales (session_id, number, subtotal_cents, total_cents, payment_method, source) VALUES (1, 1, 1000, 1000, 'yape', 'pos')");
    for (const batch of batchStatements(renderPlan(buildPlan(RAW, MAP, {})))) db.exec(batch.join('\n'));
    expect(db.prepare("SELECT COUNT(*) c FROM sales WHERE source = 'aronium'").get()).toMatchObject({ c: 2 });

    db.exec(renderRollbackSql());

    expect(db.prepare("SELECT COUNT(*) c FROM sales WHERE source = 'aronium'").get()).toMatchObject({ c: 0 });
    expect(db.prepare("SELECT COUNT(*) c FROM cash_sessions WHERE source = 'aronium'").get()).toMatchObject({ c: 0 });
    expect(db.prepare("SELECT COUNT(*) c FROM legacy_product_map").get()).toMatchObject({ c: 0 });
    expect(db.prepare("SELECT COUNT(*) c FROM sale_items").get()).toMatchObject({ c: 0 });
    expect(db.prepare("SELECT COUNT(*) c FROM sales WHERE source = 'pos'").get()).toMatchObject({ c: 1 });
    expect(db.prepare("SELECT COUNT(*) c FROM cash_sessions WHERE source = 'pos'").get()).toMatchObject({ c: 1 });
  });
});

describe('missingSlugs', () => {
  const menu: MenuEntry[] = [{ id: 1, nameEs: 'Americana', categorySlug: 'clasicas', slug: 'americana' }];

  it('lista los slugs del CSV que no existen en el menú destino', () => {
    const rows: MapRow[] = [
      { ...MAP[0]!, itemSlug: 'americana' },
      { ...MAP[0]!, legacyId: 2, itemSlug: 'no-esta' },
      { ...MAP[0]!, legacyId: 3, itemSlug: null, itemId: null },
    ];
    expect(missingSlugs(rows, menu)).toEqual(['no-esta']);
  });
});
