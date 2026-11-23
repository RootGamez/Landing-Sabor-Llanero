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
    { id: 1, name: 'pepperoni', groupName: 'Pizzas medianas' },
    { id: 2, name: 'Tequeños', groupName: 'Entradas' },
    { id: 3, name: 'Rompedieta mix', groupName: 'Pizzas medianas' },
  ],
  documents: [{ id: 1, dateCreated: '2025-04-01 20:00:00', total: 28.5, discount: 0 }],
  items: [
    { documentId: 1, productId: 1, quantity: 1, price: 25, total: 25 },
    { documentId: 1, productId: 2, quantity: 0.5, price: 7, total: 3.5 },
    { documentId: 1, productId: 3, quantity: 1, price: 0.01, total: 0.01 },
  ],
  payments: [],
  zReports: [],
};

const MATCHED: MapRow[] = [
  { legacyId: 1, legacyName: 'pepperoni', legacyGroup: 'Pizzas medianas', itemId: 99, itemSlug: 'pepperoni', sizeKey: 'mediana', status: 'auto' },
  { legacyId: 2, legacyName: 'Tequeños', legacyGroup: 'Entradas', itemId: null, itemSlug: 'tequenos', sizeKey: null, status: 'auto' },
  { legacyId: 3, legacyName: 'Rompedieta mix', legacyGroup: 'Pizzas medianas', itemId: null, itemSlug: null, sizeKey: 'mediana', status: 'unmatched' },
];

function freshDb(menuNames: Record<string, string>): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of fs.readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith('.sql')).sort()) {
    db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
  }
  db.exec("INSERT INTO sizes (key, label_es, label_en) VALUES ('mediana','Mediana','M'), ('grande','Grande','G'), ('familiar','Familiar','F')");
  db.exec("INSERT INTO categories (slug, name_es) VALUES ('t', 'T')");
  const insert = db.prepare("INSERT INTO menu_items (category_id, slug, name_es) VALUES (1, ?, ?)");
  for (const [slug, name] of Object.entries(menuNames)) insert.run(slug, name);
  return db;
}

function apply(db: DatabaseSync, map: MapRow[]): void {
  for (const batch of batchStatements(renderPlan(buildPlan(RAW, map, {})))) db.exec(batch.join('\n'));
}

function lineNames(db: DatabaseSync): string[] {
  const rows = db.prepare('SELECT name FROM sale_items ORDER BY id').all() as { name: string }[];
  return rows.map((r) => r.name);
}

describe('nombre unificado de las líneas importadas', () => {
  it('toma el name_es actual del menú, no el legacy (slug renombrado)', () => {
    const db = freshDb({ pepperoni: 'Pepperoni Clásica', tequenos: 'Tequeños Crocantes' });
    apply(db, MATCHED);
    expect(lineNames(db)[0]).toBe('Pepperoni Clásica');
  });

  it('mantiene el sufijo fraccionario después del nombre resuelto', () => {
    const db = freshDb({ pepperoni: 'Pepperoni', tequenos: 'Tequeños Crocantes' });
    apply(db, MATCHED);
    expect(lineNames(db)[1]).toBe('Tequeños Crocantes (×0,5)');
  });

  it('los no emparejados usan el nombre legacy limpio (primera letra en mayúscula)', () => {
    const db = freshDb({});
    apply(db, MATCHED);
    expect(lineNames(db)).toEqual(['Pepperoni', 'Tequeños (×0,5)', 'Rompedieta mix']);
  });

  it('si el slug no existe en el destino cae al nombre legacy limpio', () => {
    const db = freshDb({ pepperoni: 'Pepperoni' });
    apply(db, MATCHED);
    expect(lineNames(db)[1]).toBe('Tequeños (×0,5)');
  });

  it('los importes no cambian con la unificación', () => {
    const db = freshDb({ pepperoni: 'Pepperoni Clásica', tequenos: 'Tequeños Crocantes' });
    apply(db, MATCHED);
    const total = db.prepare('SELECT SUM(line_total_cents) t FROM sale_items').get() as { t: number };
    expect(total.t).toBe(2851);
  });
});

describe('relink/rename sobre lo ya importado con nombres legacy', () => {
  function legacyNamed(): DatabaseSync {
    const db = freshDb({ pepperoni: 'Pepperoni Clásica', tequenos: 'Tequeños Crocantes' });
    apply(db, MATCHED.map((r) => ({ ...r, itemId: null, itemSlug: null, status: 'unmatched' as const })));
    db.exec("UPDATE sale_items SET name = 'pepperoni' WHERE name = 'Pepperoni'");
    db.exec("UPDATE sale_items SET name = 'Tequeños (×0,5)' WHERE name LIKE 'Tequeños%'");
    return db;
  }

  it('renombra al nombre del menú conservando el sufijo y sin tocar importes', () => {
    const db = legacyNamed();
    db.exec(renderRelinkSql(MATCHED));
    expect(lineNames(db)).toEqual(['Pepperoni Clásica', 'Tequeños Crocantes (×0,5)', 'Rompedieta mix']);
    const total = db.prepare('SELECT SUM(line_total_cents) t FROM sale_items').get() as { t: number };
    expect(total.t).toBe(2851);
  });

  it('es idempotente y no deja convivir "pepperoni" y "Pepperoni"', () => {
    const db = legacyNamed();
    db.exec(renderRelinkSql(MATCHED));
    db.exec(renderRelinkSql(MATCHED));
    const distinct = db.prepare("SELECT COUNT(DISTINCT lower(name)) c, COUNT(DISTINCT name) n FROM sale_items WHERE name LIKE 'pepperoni%' OR name LIKE 'Pepperoni%'").get() as { c: number; n: number };
    expect(distinct).toEqual({ c: 1, n: 1 });
  });
});
