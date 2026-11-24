import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

/**
 * Migración 0012 (presentaciones por ítem). El harness ya aplicó TODAS las
 * migraciones (test/apply-migrations.ts): acá se verifica el esquema
 * resultante, los CHECKs y que re-ejecutar los INSERT no duplique nada.
 */

const db = env.DB;

interface Migration {
  name: string;
  queries: string[];
}

interface SizeRowShape {
  key: string;
  kind: string;
  units: number | null;
  label_es: string;
  label_en: string;
  detail_es: string;
  detail_en: string;
  display_order: number;
}

async function portions(): Promise<SizeRowShape[]> {
  const { results } = await db
    .prepare("SELECT * FROM sizes WHERE kind = 'portion' ORDER BY display_order ASC")
    .all<SizeRowShape>();
  return results;
}

describe('migración 0012_item_portions', () => {
  it('siembra las 4 presentaciones con unidades, textos bilingües y orden después de los tamaños', async () => {
    const rows = await portions();
    expect(rows.map((r) => [r.key, r.units, r.display_order])).toEqual([
      ['media_docena', 6, 100],
      ['docena', 12, 101],
      ['docena_y_media', 18, 102],
      ['dos_docenas', 24, 103],
    ]);
    expect(rows[0]).toMatchObject({
      label_es: 'Media docena',
      label_en: 'Half dozen',
      detail_es: '6 unidades',
      detail_en: '6 pieces',
    });
    expect(rows.map((r) => r.label_es)).toEqual(['Media docena', '1 docena', 'Docena y media', '2 docenas']);
    expect(rows.map((r) => r.label_en)).toEqual(['Half dozen', '1 dozen', 'Dozen and a half', '2 dozen']);
  });

  it("las filas de tamaños existentes quedan con kind 'size' por defecto y units NULL", async () => {
    await db.prepare("INSERT INTO sizes (key, label_es, label_en) VALUES ('legacy-test', 'Legacy', 'Legacy')").run();
    const row = await db.prepare("SELECT kind, units FROM sizes WHERE key = 'legacy-test'").first<{
      kind: string;
      units: number | null;
    }>();
    expect(row).toEqual({ kind: 'size', units: null });
  });

  it('el CHECK rechaza un kind desconocido y unidades no positivas', async () => {
    await expect(
      db.prepare("INSERT INTO sizes (key, label_es, label_en, kind) VALUES ('k1', 'x', 'x', 'otro')").run(),
    ).rejects.toThrow();
    await expect(
      db.prepare("INSERT INTO sizes (key, label_es, label_en, kind, units) VALUES ('k2', 'x', 'x', 'portion', 0)").run(),
    ).rejects.toThrow();
  });

  it('re-ejecutar los INSERT de la migración no duplica presentaciones (idempotente)', async () => {
    const migrations = env.TEST_MIGRATIONS as Migration[];
    const migration = migrations.find((m) => m.name.startsWith('0012'));
    expect(migration).toBeDefined();
    const withoutComments = (q: string) => q.replace(/^\s*--.*$/gm, '').trim();
    const inserts = migration!.queries.map(withoutComments).filter((q) => /^INSERT/i.test(q));
    expect(inserts.length).toBeGreaterThan(0);
    for (const query of inserts) await db.prepare(query).run();
    expect(await portions()).toHaveLength(4);
  });

  it('la migración es aditiva: no recrea ni borra tablas', () => {
    const migrations = env.TEST_MIGRATIONS as Migration[];
    const migration = migrations.find((m) => m.name.startsWith('0012'))!;
    const sql = migration.queries.join('\n');
    expect(sql).not.toMatch(/DROP\s+TABLE|CREATE\s+TABLE|ALTER\s+TABLE\s+\w+\s+RENAME/i);
  });
});
