import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { HomebankCommitResult, HomebankPreviewResult } from '@sabor/shared';
import { api, createUser, resetPos, type TestUser } from '../../test/pos-fixtures';

const hex = (n: number, suffix = '') => `${n.toString(16).padStart(64, '0')}${suffix}`;

interface ExpenseRowIn {
  date: string;
  amountCents: number;
  category: string;
  description: string;
  paymentMethod: string;
  hash: string;
}
interface IncomeRowIn {
  date: string;
  amountCents: number;
  hash: string;
}

const expense = (n: number, patch: Partial<ExpenseRowIn> = {}): ExpenseRowIn => ({
  date: '2026-03-10',
  amountCents: 1_250,
  category: 'Compras',
  description: 'Sabor Llanero - Compra',
  paymentMethod: 'efectivo',
  hash: hex(n),
  ...patch,
});
const income = (n: number, patch: Partial<IncomeRowIn> = {}): IncomeRowIn => ({
  date: '2026-03-10',
  amountCents: 30_000,
  hash: hex(1000 + n),
  ...patch,
});

describe('routes/imports (HomeBank)', () => {
  let owner: TestUser;
  let admin: TestUser;
  let cashier: TestUser;

  beforeAll(async () => {
    owner = await createUser('imp-owner@test.local', 'owner');
    admin = await createUser('imp-admin@test.local', 'admin');
    cashier = await createUser('imp-cashier@test.local', 'cashier');
  });

  beforeEach(async () => {
    await resetPos();
    // Hijas primero (FK RESTRICT del padre); las categorías base del seed no se tocan.
    await env.DB.batch([
      env.DB.prepare("DELETE FROM expense_categories WHERE parent_id IS NOT NULL AND name IN ('Hija', 'Otra')"),
      env.DB.prepare("DELETE FROM expense_categories WHERE name IN ('Compras', 'Padre', 'Otra')"),
    ]);
  });

  const preview = (body: unknown, token: string | undefined = owner.token) =>
    api<HomebankPreviewResult & { error?: string }>('/imports/homebank/preview', { token, method: 'POST', body });
  const commit = (body: unknown, token: string | undefined = owner.token) =>
    api<HomebankCommitResult & { error?: string }>('/imports/homebank/commit', { token, method: 'POST', body });

  const count = async (table: string, where = '1=1') =>
    (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).first<{ n: number }>())!.n;

  describe('acceso (solo owner)', () => {
    it.each([
      ['anónimo', undefined, 401],
      ['cajero', () => cashier.token, 403],
      ['admin', () => admin.token, 403],
    ] as const)('%s: preview y commit', async (_label, token, status) => {
      const t = typeof token === 'function' ? token() : token;
      const rows = { expenses: [expense(1)], incomes: [] };
      const previewRes = await api('/imports/homebank/preview', { token: t, method: 'POST', body: rows });
      const commitRes = await api('/imports/homebank/commit', {
        token: t,
        method: 'POST',
        body: { ...rows, categoryMap: { Compras: 'create' } },
      });
      expect(previewRes.status).toBe(status);
      expect(commitRes.status).toBe(status);
      expect(await count('expenses')).toBe(0);
    });
  });

  describe('validación (no se confía en el cliente)', () => {
    const bad: Array<[string, unknown]> = [
      ['monto negativo', { expenses: [expense(1, { amountCents: -5 })], incomes: [] }],
      ['monto cero', { expenses: [expense(1, { amountCents: 0 })], incomes: [] }],
      ['monto decimal', { expenses: [expense(1, { amountCents: 10.5 })], incomes: [] }],
      ['monto sobre el máximo', { expenses: [expense(1, { amountCents: 100_000_000 })], incomes: [] }],
      ['hash inválido', { expenses: [expense(1, { hash: 'xyz' })], incomes: [] }],
      ['hash en mayúsculas', { expenses: [expense(1, { hash: hex(255).toUpperCase() })], incomes: [] }],
      ['hash con sufijo inválido', { expenses: [expense(1, { hash: `${hex(1)}#x` })], incomes: [] }],
      ['fecha fuera de rango (año 9999)', { expenses: [], incomes: [income(1, { date: '9999-12-31' })] }],
      ['fecha anterior a 2000', { expenses: [expense(1, { date: '1999-12-31' })], incomes: [] }],
      ['fecha imposible', { expenses: [expense(1, { date: '2026-02-30' })], incomes: [] }],
      ['descripción larga', { expenses: [expense(1, { description: 'a'.repeat(201) })], incomes: [] }],
      ['texto con control', { expenses: [expense(1, { description: 'a\u0000b' })], incomes: [] }],
      ['método de pago desconocido', { expenses: [expense(1, { paymentMethod: 'bitcoin' })], incomes: [] }],
      ['ingreso negativo', { expenses: [], incomes: [income(1, { amountCents: -1 })] }],
      ['ingreso con hash inválido', { expenses: [], incomes: [income(1, { hash: 'abc' })] }],
      ['sin filas', { expenses: [], incomes: [] }],
      ['faltan campos', {}],
      ['más de 500 filas', { expenses: Array.from({ length: 501 }, (_, i) => expense(i + 1)), incomes: [] }],
    ];

    it.each(bad)('preview rechaza: %s', async (_label, body) => {
      expect((await preview(body)).status).toBe(400);
    });

    it.each(bad)('commit rechaza: %s', async (_label, body) => {
      const res = await commit({ ...(body as object), categoryMap: { Compras: 'create' } });
      expect(res.status).toBe(400);
      expect(await count('expenses')).toBe(0);
      expect(await count('sales')).toBe(0);
    });

    it('acepta exactamente 500 filas', async () => {
      const rows = Array.from({ length: 500 }, (_, i) => expense(i + 1, { amountCents: 100 + i }));
      const res = await commit({ expenses: rows, incomes: [], categoryMap: { Compras: 'create' } });
      expect(res.status).toBe(200);
      expect(res.body.expenses.inserted).toBe(500);
    });

    it('commit rechaza categoryMap con valor inválido', async () => {
      for (const value of [-1, 0, 'nope', null, 1.5]) {
        const res = await commit({ expenses: [expense(1)], incomes: [], categoryMap: { Compras: value } });
        expect(res.status, String(value)).toBe(400);
      }
    });

    it('commit exige mapear cada categoría usada', async () => {
      const res = await commit({ expenses: [expense(1)], incomes: [], categoryMap: {} });
      expect(res.status).toBe(400);
      expect(await count('expenses')).toBe(0);
    });

    it('commit rechaza una categoría de destino inexistente', async () => {
      const res = await commit({ expenses: [expense(1)], incomes: [], categoryMap: { Compras: 999_999 } });
      expect(res.status).toBe(400);
    });

    it('commit rechaza mapear a una categoría inactiva', async () => {
      const row = await env.DB.prepare(
        "INSERT INTO expense_categories (name, is_active) VALUES ('Otra', 0) RETURNING id",
      ).first<{ id: number }>();
      const res = await commit({ expenses: [expense(1)], incomes: [], categoryMap: { Compras: row!.id } });
      expect(res.status).toBe(400);
    });

    it('commit rechaza crear una categoría sin nombre usable', async () => {
      const res = await commit({
        expenses: [expense(1, { category: '' })],
        incomes: [],
        categoryMap: { '': 'create' },
      });
      expect(res.status).toBe(400);
    });

    it('un categoryMap con clave __proto__ no contamina nada', async () => {
      const body = JSON.parse('{"expenses":[],"incomes":[],"categoryMap":{"__proto__":"create"}}') as unknown;
      const res = await commit(body);
      expect(res.status).toBe(400);
    });
  });

  describe('preview', () => {
    it('informa categorías inexistentes y existentes (incluye Padre:Hija)', async () => {
      const insumos = await env.DB.prepare("SELECT id FROM expense_categories WHERE name = 'Insumos'").first<{
        id: number;
      }>();
      const res = await preview({
        expenses: [
          expense(1, { category: 'Insumos' }),
          expense(2, { category: 'Compras' }),
          expense(3, { category: 'Compras' }),
          expense(4, { category: 'Insumos:Hija' }),
          expense(5, { category: 'Padre:Hija' }),
        ],
        incomes: [income(1)],
      });
      expect(res.status).toBe(200);
      expect(res.body.expenses).toEqual({ total: 5, existing: 0 });
      expect(res.body.incomes).toEqual({ total: 1, existing: 0 });
      const byName = Object.fromEntries(res.body.categories.map((c) => [c.name, c]));
      expect(byName.Insumos).toEqual({ name: 'Insumos', categoryId: insumos!.id, count: 1 });
      expect(byName.Compras).toEqual({ name: 'Compras', categoryId: null, count: 2 });
      expect(byName['Insumos:Hija']?.categoryId).toBeNull();
      expect(byName['Padre:Hija']?.categoryId).toBeNull();
    });

    it('cuenta los ya importados (gastos e ingresos) sin escribir nada', async () => {
      const body = { expenses: [expense(1), expense(2)], incomes: [income(1)] };
      await commit({ ...body, categoryMap: { Compras: 'create' } });
      const res = await preview({ expenses: [expense(1), expense(2), expense(3)], incomes: [income(1), income(2)] });
      expect(res.body.expenses).toEqual({ total: 3, existing: 2 });
      expect(res.body.incomes).toEqual({ total: 2, existing: 1 });
      expect(await count('expenses')).toBe(2);
      expect(await count('sales')).toBe(1);
    });
  });

  describe('commit de gastos', () => {
    it('inserta con source homebank, hash, categoría creada y método de pago', async () => {
      const res = await commit({
        expenses: [expense(1, { paymentMethod: 'tarjeta', description: 'Pollo' })],
        incomes: [],
        categoryMap: { Compras: 'create' },
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        expenses: { inserted: 1, duplicates: 0 },
        incomes: { inserted: 0, duplicates: 0 },
      });
      const row = await env.DB.prepare(
        'SELECT e.*, c.name AS cat FROM expenses e JOIN expense_categories c ON c.id = e.category_id',
      ).first<Record<string, unknown>>();
      expect(row).toMatchObject({
        source: 'homebank',
        import_hash: hex(1),
        amount_cents: 1_250,
        date: '2026-03-10',
        payment_method: 'tarjeta',
        description: 'Pollo',
        paid_from_register: 0,
        session_id: null,
        created_by: owner.id,
        cat: 'Compras',
      });
    });

    it('es idempotente: el segundo commit no inserta nada ni duplica categorías', async () => {
      const body = {
        expenses: [expense(1), expense(2)],
        incomes: [income(1)],
        categoryMap: { Compras: 'create' as const },
      };
      const first = await commit(body);
      expect(first.body.expenses.inserted).toBe(2);
      expect(first.body.incomes.inserted).toBe(1);

      const second = await commit(body);
      expect(second.status).toBe(200);
      expect(second.body).toEqual({
        expenses: { inserted: 0, duplicates: 2 },
        incomes: { inserted: 0, duplicates: 1 },
      });
      expect(await count('expenses')).toBe(2);
      expect(await count('sales')).toBe(1);
      expect(await count('cash_sessions')).toBe(1);
      expect(await count('expense_categories', "name = 'Compras'")).toBe(1);
    });

    it('compras idénticas del mismo día (hash con #n) se insertan ambas y no chocan al reimportar', async () => {
      const body = {
        expenses: [expense(1), expense(1, { hash: `${hex(1)}#1` })],
        incomes: [],
        categoryMap: { Compras: 'create' as const },
      };
      expect((await commit(body)).body.expenses).toEqual({ inserted: 2, duplicates: 0 });
      expect((await commit(body)).body.expenses).toEqual({ inserted: 0, duplicates: 2 });
      expect(await count('expenses')).toBe(2);
    });

    it('un hash repetido dentro del mismo request cuenta como duplicado', async () => {
      const res = await commit({
        expenses: [expense(1), expense(1)],
        incomes: [],
        categoryMap: { Compras: 'create' },
      });
      expect(res.body.expenses).toEqual({ inserted: 1, duplicates: 1 });
    });

    it('no resucita un gasto eliminado (borrado lógico) al reimportar', async () => {
      const body = { expenses: [expense(1)], incomes: [], categoryMap: { Compras: 'create' as const } };
      await commit(body);
      await env.DB.prepare("UPDATE expenses SET deleted_at = datetime('now')").run();
      expect((await commit(body)).body.expenses).toEqual({ inserted: 0, duplicates: 1 });
    });

    it('asigna a una categoría existente por id', async () => {
      const gas = await env.DB.prepare("SELECT id FROM expense_categories WHERE name = 'Gas'").first<{ id: number }>();
      await commit({ expenses: [expense(1)], incomes: [], categoryMap: { Compras: gas!.id } });
      const row = await env.DB.prepare('SELECT category_id FROM expenses').first<{ category_id: number }>();
      expect(row!.category_id).toBe(gas!.id);
      expect(await count('expense_categories', "name = 'Compras'")).toBe(0);
    });

    it('"Padre:Hija" con create crea el padre y la hija, y reutiliza el padre existente', async () => {
      await commit({
        expenses: [expense(1, { category: 'Padre:Hija' })],
        incomes: [],
        categoryMap: { 'Padre:Hija': 'create' },
      });
      await commit({
        expenses: [expense(2, { category: 'Padre:Otra' })],
        incomes: [],
        categoryMap: { 'Padre:Otra': 'create' },
      });
      expect(await count('expense_categories', "name = 'Padre' AND parent_id IS NULL")).toBe(1);
      const rows = await env.DB.prepare(
        `SELECT c.name, p.name AS parent FROM expenses e
           JOIN expense_categories c ON c.id = e.category_id
           JOIN expense_categories p ON p.id = c.parent_id ORDER BY e.id`,
      ).all<{ name: string; parent: string }>();
      expect(rows.results).toEqual([
        { name: 'Hija', parent: 'Padre' },
        { name: 'Otra', parent: 'Padre' },
      ]);
    });

    it('create reutiliza una categoría existente con el mismo nombre (sin distinguir mayúsculas)', async () => {
      const gas = await env.DB.prepare("SELECT id FROM expense_categories WHERE name = 'Gas'").first<{ id: number }>();
      await commit({ expenses: [expense(1, { category: 'gas' })], incomes: [], categoryMap: { gas: 'create' } });
      const row = await env.DB.prepare('SELECT category_id FROM expenses').first<{ category_id: number }>();
      expect(row!.category_id).toBe(gas!.id);
    });

    it('una categoría vacía se asigna a una existente', async () => {
      const otros = await env.DB.prepare("SELECT id FROM expense_categories WHERE name = 'Otros'").first<{
        id: number;
      }>();
      const res = await commit({
        expenses: [expense(1, { category: '' })],
        incomes: [],
        categoryMap: { '': otros!.id },
      });
      expect(res.status).toBe(200);
    });
  });

  describe('commit de ingresos (ventas resumen)', () => {
    const catMap = { categoryMap: {} };

    it('crea una sesión cerrada por día (00:00–23:59 Lima) con una venta resumen por fila', async () => {
      const res = await commit({
        expenses: [],
        incomes: [income(1), income(2, { amountCents: 12_345 }), income(3, { date: '2026-03-11', amountCents: 500 })],
        ...catMap,
      });
      expect(res.body.incomes).toEqual({ inserted: 3, duplicates: 0 });

      const sessions = await env.DB.prepare('SELECT * FROM cash_sessions ORDER BY legacy_ref').all<
        Record<string, unknown>
      >();
      expect(sessions.results).toHaveLength(2);
      expect(sessions.results[0]).toMatchObject({
        source: 'homebank',
        legacy_ref: 'homebank:day:2026-03-10',
        opened_at: '2026-03-10 05:00:00',
        closed_at: '2026-03-11 04:59:00',
        opening_cash_cents: 0,
        counted_cash_cents: 42_345,
        expected_cash_cents: 42_345,
        opened_by: owner.id,
        closed_by: owner.id,
      });
      expect(sessions.results[1]).toMatchObject({
        legacy_ref: 'homebank:day:2026-03-11',
        counted_cash_cents: 500,
        expected_cash_cents: 500,
      });

      const sales = await env.DB.prepare(
        'SELECT s.*, cs.legacy_ref AS day FROM sales s JOIN cash_sessions cs ON cs.id = s.session_id ORDER BY s.id',
      ).all<Record<string, unknown>>();
      expect(sales.results.map((s) => [s.day, s.number, s.total_cents])).toEqual([
        ['homebank:day:2026-03-10', 1, 30_000],
        ['homebank:day:2026-03-10', 2, 12_345],
        ['homebank:day:2026-03-11', 1, 500],
      ]);
      expect(sales.results[0]).toMatchObject({
        source: 'homebank',
        legacy_ref: `homebank:${hex(1001)}`,
        payment_method: 'efectivo',
        subtotal_cents: 30_000,
        discount_cents: 0,
        voided_at: null,
        created_by: owner.id,
      });
      const items = await env.DB.prepare('SELECT * FROM sale_items ORDER BY id').all<Record<string, unknown>>();
      expect(items.results).toHaveLength(3);
      expect(items.results[0]).toMatchObject({
        name: 'Venta del día (resumen)',
        quantity: 1,
        unit_price_cents: 30_000,
        line_total_cents: 30_000,
        item_id: null,
        size_id: null,
      });
    });

    it('un día repartido en dos lotes acumula en la misma sesión y renumera sin chocar', async () => {
      await commit({ expenses: [], incomes: [income(1)], ...catMap });
      const second = await commit({ expenses: [], incomes: [income(2, { amountCents: 100 })], ...catMap });
      expect(second.body.incomes.inserted).toBe(1);
      expect(await count('cash_sessions')).toBe(1);
      const s = await env.DB.prepare(
        'SELECT expected_cash_cents AS e, counted_cash_cents AS c FROM cash_sessions',
      ).first<{ e: number; c: number }>();
      expect(s).toEqual({ e: 30_100, c: 30_100 });
      const numbers = await env.DB.prepare('SELECT number FROM sales ORDER BY number').all<{ number: number }>();
      expect(numbers.results.map((r) => r.number)).toEqual([1, 2]);
    });

    it('no mezcla con una sesión pos real del mismo día', async () => {
      const real = await env.DB.prepare(
        "INSERT INTO cash_sessions (opened_at, opened_by, opening_cash_cents) VALUES ('2026-03-10 18:00:00', ?, 0) RETURNING id",
      )
        .bind(owner.id)
        .first<{ id: number }>();
      const res = await commit({ expenses: [], incomes: [income(1)], ...catMap });
      expect(res.body.incomes.inserted).toBe(1);
      expect(await count('sales', `session_id = ${real!.id}`)).toBe(0);
      const open = await env.DB.prepare('SELECT closed_at FROM cash_sessions WHERE id = ?')
        .bind(real!.id)
        .first<{ closed_at: string | null }>();
      expect(open!.closed_at).toBeNull();
      expect(await count('cash_sessions', "source = 'homebank'")).toBe(1);
    });

    it('no toca la caja abierta ni crea gastos de caja', async () => {
      await env.DB.prepare('INSERT INTO cash_sessions (opened_by, opening_cash_cents) VALUES (?, 5000)')
        .bind(owner.id)
        .run();
      await commit({ expenses: [expense(1)], incomes: [income(1)], categoryMap: { Compras: 'create' } });
      expect(await count('cash_sessions', 'closed_at IS NULL')).toBe(1);
      expect(await count('expenses', 'paid_from_register = 1')).toBe(0);
    });
  });
});
