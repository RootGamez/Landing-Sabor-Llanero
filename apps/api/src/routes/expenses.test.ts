import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CashSessionDetail, Expense, ExpenseListResult } from '@sabor/shared';
import { api, createUser, openCash, resetPos, type TestUser } from '../../test/pos-fixtures';

type ExpenseBody = Partial<{
  date: string;
  amountCents: number;
  categoryId: number;
  description: string;
  paymentMethod: string;
  paidFromRegister: boolean;
}>;

describe('routes/expenses', () => {
  let owner: TestUser;
  let admin: TestUser;
  let cashier: TestUser;
  let insumos: number;
  let gas: number;

  beforeAll(async () => {
    owner = await createUser('exp-owner@test.local', 'owner');
    admin = await createUser('exp-admin@test.local', 'admin');
    cashier = await createUser('exp-cashier@test.local', 'cashier');
    const rows = await env.DB.prepare("SELECT id, name FROM expense_categories WHERE name IN ('Insumos', 'Gas')").all<{
      id: number;
      name: string;
    }>();
    insumos = rows.results.find((r) => r.name === 'Insumos')!.id;
    gas = rows.results.find((r) => r.name === 'Gas')!.id;
  });

  beforeEach(resetPos);

  const post = (token: string | undefined, body: ExpenseBody = {}) =>
    api<Expense & { error?: string }>('/expenses', {
      token,
      method: 'POST',
      body: {
        date: '2026-03-10',
        amountCents: 2_500,
        categoryId: insumos,
        description: 'Queso mozzarella',
        paymentMethod: 'efectivo',
        ...body,
      },
    });

  const list = (qs = '', token = owner.token) => api<ExpenseListResult>(`/expenses${qs}`, { token });

  describe('acceso', () => {
    it('anónimo 401 y cajero 403 en todas las rutas', async () => {
      for (const [method, path] of [
        ['GET', '/expenses'],
        ['POST', '/expenses'],
        ['PATCH', '/expenses/1'],
        ['DELETE', '/expenses/1'],
      ] as const) {
        expect((await api(path, { method })).status, `${method} ${path} anon`).toBe(401);
        expect((await api(path, { method, token: cashier.token, body: method === 'GET' ? undefined : {} })).status, `${method} ${path} cashier`).toBe(403);
      }
    });
  });

  describe('POST /', () => {
    it('crea un gasto manual (owner y admin) con created_by', async () => {
      for (const staff of [owner, admin]) {
        const res = await post(staff.token);
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
          date: '2026-03-10',
          amountCents: 2_500,
          categoryId: insumos,
          description: 'Queso mozzarella',
          paymentMethod: 'efectivo',
          paidFromRegister: false,
          sessionId: null,
          source: 'manual',
          createdBy: staff.id,
        });
      }
    });

    it('valida el body (400): monto, fecha, categoría y método de pago', async () => {
      const invalid: ExpenseBody[] = [
        { amountCents: 0 },
        { amountCents: -5 },
        { amountCents: 10.5 },
        { date: '2026-02-30' },
        { date: 'ayer' },
        { categoryId: 999_999 },
        { paymentMethod: 'bitcoin' },
        { description: 'ab' },
      ];
      for (const body of invalid) {
        expect((await post(owner.token, body)).status, JSON.stringify(body)).toBe(400);
      }
    });

    it('rechaza una categoría desactivada (400)', async () => {
      await env.DB.prepare('UPDATE expense_categories SET is_active = 0 WHERE id = ?').bind(gas).run();
      expect((await post(owner.token, { categoryId: gas })).status).toBe(400);
      await env.DB.prepare('UPDATE expense_categories SET is_active = 1 WHERE id = ?').bind(gas).run();
    });

    it('paidFromRegister exige caja abierta (409) y guarda session_id', async () => {
      const without = await post(owner.token, { paidFromRegister: true });
      expect(without.status).toBe(409);
      const sessionId = await openCash(owner.token);
      const ok = await post(owner.token, { paidFromRegister: true });
      expect(ok.status).toBe(201);
      expect(ok.body).toMatchObject({ paidFromRegister: true, sessionId });
    });

    it('paidFromRegister solo aplica a efectivo (400)', async () => {
      await openCash(owner.token);
      expect((await post(owner.token, { paidFromRegister: true, paymentMethod: 'yape' })).status).toBe(400);
    });

    it('un gasto de caja descuenta del efectivo esperado en vivo', async () => {
      await openCash(owner.token, 10_000);
      await post(owner.token, { paidFromRegister: true, amountCents: 3_000 });
      const current = await api<CashSessionDetail>('/cash-sessions/current', { token: owner.token });
      expect(current.body.summary.cashExpensesCents).toBe(3_000);
      expect(current.body.summary.expectedCashCents).toBe(7_000);
    });
  });

  describe('GET /', () => {
    beforeEach(async () => {
      await post(owner.token, { date: '2026-03-08', amountCents: 1_000, description: 'Gas del mes' , categoryId: gas });
      await post(owner.token, { date: '2026-03-09', amountCents: 2_000, description: 'Harina 50% integral' });
      await post(owner.token, { date: '2026-03-10', amountCents: 3_000, paymentMethod: 'yape' });
      await post(owner.token, { date: '2026-03-10', amountCents: 4_000, description: 'Queso' });
    });

    it('lista paginada, más reciente primero, con total del filtro y total diario', async () => {
      const res = await list('?pageSize=2');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 4, totalCents: 10_000, page: 1, pageSize: 2 });
      expect(res.body.items.map((e) => e.date)).toEqual(['2026-03-10', '2026-03-10']);
      expect(res.body.dayTotals).toEqual([{ date: '2026-03-10', totalCents: 7_000 }]);
      const second = await list('?pageSize=2&page=2');
      expect(second.body.items.map((e) => e.date)).toEqual(['2026-03-09', '2026-03-08']);
      expect(second.body.totalCents).toBe(10_000);
    });

    it('filtra por rango de fechas local', async () => {
      const res = await list('?from=2026-03-09&to=2026-03-09');
      expect(res.body.total).toBe(1);
      expect(res.body.totalCents).toBe(2_000);
    });

    it('filtra por categoría y por método de pago', async () => {
      expect((await list(`?category_id=${gas}`)).body.totalCents).toBe(1_000);
      expect((await list('?payment_method=yape')).body.totalCents).toBe(3_000);
    });

    it('el filtro por categoría padre incluye a sus hijas', async () => {
      const child = await env.DB.prepare("INSERT INTO expense_categories (name, parent_id) VALUES ('Garrafa', ?) RETURNING id")
        .bind(gas)
        .first<{ id: number }>();
      await post(owner.token, { categoryId: child!.id, amountCents: 500 });
      expect((await list(`?category_id=${gas}`)).body.totalCents).toBe(1_500);
      expect((await list(`?category_id=${child!.id}`)).body.totalCents).toBe(500);
    });

    it('busca por texto sin tratar % ni _ como comodines', async () => {
      expect((await list('?q=queso')).body.total).toBe(2); // 'Queso mozzarella' + 'Queso'
      expect((await list(`?q=${encodeURIComponent('50%')}`)).body.total).toBe(1);
      expect((await list(`?q=${encodeURIComponent('%')}`)).body.total).toBe(1);
      expect((await list(`?q=${encodeURIComponent('_')}`)).body.total).toBe(0);
    });

    it('una búsqueda larga o con muchos comodines no rompe el LIKE de D1 (se recorta, no da 500)', async () => {
      expect((await list(`?q=${encodeURIComponent('%_'.repeat(60))}`)).status).toBe(200);
      expect((await list(`?q=${'ñ'.repeat(200)}`)).status).toBe(200);
    });

    it('excluye los eliminados del listado y de los totales', async () => {
      const all = await list();
      await api(`/expenses/${all.body.items[0]!.id}`, { token: owner.token, method: 'DELETE' });
      const after = await list();
      expect(after.body.total).toBe(3);
      expect(after.body.totalCents).toBe(10_000 - all.body.items[0]!.amountCents);
    });

    it('rechaza filtros inválidos (400)', async () => {
      for (const qs of ['from=ayer', 'to=2026-02-30', 'from=2026-03-10&to=2026-03-01', 'category_id=abc', 'payment_method=BAD!']) {
        expect((await list(`?${qs}`)).status, qs).toBe(400);
      }
    });

    it('el admin también lista', async () => {
      expect((await list('', admin.token)).status).toBe(200);
    });
  });

  describe('PATCH /:id', () => {
    it('actualiza solo los campos enviados', async () => {
      const created = await post(owner.token);
      const res = await api<Expense>(`/expenses/${created.body.id}`, {
        token: admin.token,
        method: 'PATCH',
        body: { amountCents: 9_900, description: 'Corregido' },
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        amountCents: 9_900,
        description: 'Corregido',
        date: '2026-03-10',
        categoryId: insumos,
        paymentMethod: 'efectivo',
      });
    });

    it('400 con body vacío o inválido, 404 si no existe o está eliminado', async () => {
      const created = await post(owner.token);
      const patch = (id: number | string, body: unknown) =>
        api(`/expenses/${id}`, { token: owner.token, method: 'PATCH', body });
      expect((await patch(created.body.id, {})).status).toBe(400);
      expect((await patch(created.body.id, { amountCents: 0 })).status).toBe(400);
      expect((await patch(created.body.id, { categoryId: 999_999 })).status).toBe(400);
      expect((await patch('abc', { amountCents: 100 })).status).toBe(400);
      expect((await patch(999_999, { amountCents: 100 })).status).toBe(404);
      await api(`/expenses/${created.body.id}`, { token: owner.token, method: 'DELETE' });
      expect((await patch(created.body.id, { amountCents: 100 })).status).toBe(404);
    });

    it('marcar "de caja" exige caja abierta y asigna la sesión; desmarcar la limpia', async () => {
      const created = await post(owner.token);
      const mark = (flag: boolean) =>
        api<Expense & { error?: string }>(`/expenses/${created.body.id}`, {
          token: owner.token,
          method: 'PATCH',
          body: { paidFromRegister: flag },
        });
      expect((await mark(true)).status).toBe(409);
      const sessionId = await openCash(owner.token);
      expect((await mark(true)).body).toMatchObject({ paidFromRegister: true, sessionId });
      expect((await mark(false)).body).toMatchObject({ paidFromRegister: false, sessionId: null });
    });

    it('no deja un gasto de caja con método distinto de efectivo (400)', async () => {
      await openCash(owner.token);
      const created = await post(owner.token, { paidFromRegister: true });
      const res = await api(`/expenses/${created.body.id}`, {
        token: owner.token,
        method: 'PATCH',
        body: { paymentMethod: 'yape' },
      });
      expect(res.status).toBe(400);
    });

    it('editar el monto de un gasto de caja ya cerrada: solo owner (admin 403) y recalcula el snapshot', async () => {
      const sessionId = await openCash(owner.token, 10_000);
      const created = await post(owner.token, { paidFromRegister: true, amountCents: 2_000 });
      await api(`/cash-sessions/${sessionId}/close`, { token: owner.token, method: 'POST', body: { countedCashCents: 8_000 } });

      const denied = await api(`/expenses/${created.body.id}`, { token: admin.token, method: 'PATCH', body: { amountCents: 3_000 } });
      expect(denied.status).toBe(403);

      const ok = await api(`/expenses/${created.body.id}`, { token: owner.token, method: 'PATCH', body: { amountCents: 3_000 } });
      expect(ok.status).toBe(200);
      const detail = await api<CashSessionDetail>(`/cash-sessions/${sessionId}`, { token: owner.token });
      expect(detail.body.expectedCashCents).toBe(7_000);
      expect(detail.body.countedCashCents).toBe(8_000);
      expect(detail.body.closeSnapshot).toMatchObject({
        cashExpensesCents: 3_000,
        expectedCashCents: 7_000,
        countedCashCents: 8_000,
        differenceCents: 1_000,
      });
    });

    it('editar la nota de un gasto de caja cerrada no requiere owner', async () => {
      const sessionId = await openCash(owner.token);
      const created = await post(owner.token, { paidFromRegister: true });
      await api(`/cash-sessions/${sessionId}/close`, { token: owner.token, method: 'POST', body: { countedCashCents: 0 } });
      const res = await api(`/expenses/${created.body.id}`, { token: admin.token, method: 'PATCH', body: { description: 'Nota' } });
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /:id', () => {
    it('borra lógicamente (conserva la fila con deleted_at) y un segundo borrado da 404', async () => {
      const created = await post(owner.token);
      const res = await api(`/expenses/${created.body.id}`, { token: admin.token, method: 'DELETE' });
      expect(res.status).toBe(200);
      const row = await env.DB.prepare('SELECT deleted_at FROM expenses WHERE id = ?')
        .bind(created.body.id)
        .first<{ deleted_at: string | null }>();
      expect(row!.deleted_at).not.toBeNull();
      expect((await api(`/expenses/${created.body.id}`, { token: admin.token, method: 'DELETE' })).status).toBe(404);
      expect((await api('/expenses/abc', { token: admin.token, method: 'DELETE' })).status).toBe(400);
    });

    it('eliminar un gasto de caja libera el efectivo esperado de la caja abierta', async () => {
      await openCash(owner.token, 10_000);
      const created = await post(owner.token, { paidFromRegister: true, amountCents: 4_000 });
      await api(`/expenses/${created.body.id}`, { token: owner.token, method: 'DELETE' });
      const current = await api<CashSessionDetail>('/cash-sessions/current', { token: owner.token });
      expect(current.body.summary.expectedCashCents).toBe(10_000);
    });

    it('eliminar un gasto de caja de una sesión cerrada: solo owner y recalcula el snapshot', async () => {
      const sessionId = await openCash(owner.token, 10_000);
      const created = await post(owner.token, { paidFromRegister: true, amountCents: 2_000 });
      await api(`/cash-sessions/${sessionId}/close`, { token: owner.token, method: 'POST', body: { countedCashCents: 8_000 } });
      expect((await api(`/expenses/${created.body.id}`, { token: admin.token, method: 'DELETE' })).status).toBe(403);
      expect((await api(`/expenses/${created.body.id}`, { token: owner.token, method: 'DELETE' })).status).toBe(200);
      const detail = await api<CashSessionDetail>(`/cash-sessions/${sessionId}`, { token: owner.token });
      expect(detail.body.expectedCashCents).toBe(10_000);
      expect(detail.body.closeSnapshot).toMatchObject({ cashExpensesCents: 0, differenceCents: -2_000 });
    });
  });
});
