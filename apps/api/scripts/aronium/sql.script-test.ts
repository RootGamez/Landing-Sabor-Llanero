import { describe, expect, it } from 'vitest';
import { batchStatements, renderPlan, renderVerifySql, sqlString } from './sql';
import { buildPlan } from './transform';
import type { MapRow, RawData } from './types';

describe('sqlString', () => {
  it('duplica comillas simples', () => {
    expect(sqlString("Pan d'ajo")).toBe("'Pan d''ajo'");
  });

  it('neutraliza intentos de inyección', () => {
    expect(sqlString("x'); DROP TABLE sales; --")).toBe("'x''); DROP TABLE sales; --'");
  });

  it('rechaza caracteres NUL', () => {
    expect(() => sqlString('a\0b')).toThrow();
  });
});

describe('batchStatements', () => {
  it('corta por cantidad', () => {
    const stmts = Array.from({ length: 10 }, (_, i) => `SELECT ${i};`);
    const batches = batchStatements(stmts, { maxStatements: 4, maxBytes: 10_000 });
    expect(batches.map((b) => b.length)).toEqual([4, 4, 2]);
  });

  it('corta por tamaño sin perder ni reordenar sentencias', () => {
    const stmts = Array.from({ length: 6 }, (_, i) => `SELECT '${'x'.repeat(40)}${i}';`);
    const batches = batchStatements(stmts, { maxStatements: 400, maxBytes: 100 });
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flat()).toEqual(stmts);
  });

  it('una sentencia más grande que el límite va sola', () => {
    const batches = batchStatements(['SELECT 1;', `SELECT '${'y'.repeat(200)}';`, 'SELECT 2;'], { maxStatements: 400, maxBytes: 50 });
    expect(batches.map((b) => b.length)).toEqual([1, 1, 1]);
  });
});

const RAW: RawData = {
  products: [{ id: 1, name: "Pan d'ajo", groupName: 'Entradas' }],
  documents: [{ id: 10, dateCreated: '2025-04-01 20:00:00', total: 5, discount: 0 }],
  items: [{ documentId: 10, productId: 1, quantity: 1, price: 5, total: 5 }],
  payments: [],
  zReports: [{ id: 3, number: 1, fromDocumentId: 10, toDocumentId: 10 }],
};
const MAP: MapRow[] = [
  { legacyId: 1, legacyName: "Pan d'ajo", legacyGroup: 'Entradas', itemId: 7, sizeKey: null, status: 'auto' },
];

describe('renderPlan', () => {
  const statements = renderPlan(buildPlan(RAW, MAP, {}));
  const sql = statements.join('\n');

  it('emite INSERT OR IGNORE idempotentes con legacy_ref', () => {
    expect(sql).toContain('INSERT OR IGNORE INTO cash_sessions');
    expect(sql).toContain("'aronium:z:3'");
    expect(sql).toContain('INSERT OR IGNORE INTO sales');
    expect(sql).toContain("'aronium:doc:10'");
    expect(sql).toContain('INSERT OR IGNORE INTO legacy_product_map');
  });

  it('enlaza por subselect, sin ids de sesión/venta hardcodeados', () => {
    expect(sql).toContain("(SELECT id FROM cash_sessions WHERE legacy_ref = 'aronium:z:3')");
    expect(sql).toContain("s.legacy_ref = 'aronium:doc:10'");
    expect(sql).toContain('NOT EXISTS');
  });

  it('escapa los nombres', () => {
    expect(sql).toContain("'Pan d''ajo'");
  });

  it('cada sentencia termina en punto y coma', () => {
    for (const stmt of statements) expect(stmt.trimEnd().endsWith(';')).toBe(true);
  });
});

describe('renderVerifySql', () => {
  it('incluye los totales esperados y los SELECT de control', () => {
    const sql = renderVerifySql({ salesCount: 2392, itemsCount: 3278, totalCents: 10385350, sessionsCount: 227 });
    expect(sql).toContain('2392');
    expect(sql).toContain('10385350');
    expect(sql).toContain("FROM sales WHERE source = 'aronium'");
  });
});
