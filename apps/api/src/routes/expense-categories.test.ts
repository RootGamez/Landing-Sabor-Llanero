import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ExpenseCategory, ExpenseCategoryNode } from '@sabor/shared';
import { api, createUser, type TestUser } from '../../test/pos-fixtures';

describe('routes/expense-categories', () => {
  let owner: TestUser;
  let admin: TestUser;
  let cashier: TestUser;

  beforeAll(async () => {
    owner = await createUser('expcat-owner@test.local', 'owner');
    admin = await createUser('expcat-admin@test.local', 'admin');
    cashier = await createUser('expcat-cashier@test.local', 'cashier');
  });

  const create = (body: unknown, token = owner.token) =>
    api<ExpenseCategory & { error?: string }>('/expense-categories', { token, method: 'POST', body });
  const patch = (id: number | string, body: unknown, token = owner.token) =>
    api<ExpenseCategory & { error?: string }>(`/expense-categories/${id}`, { token, method: 'PATCH', body });
  const remove = (id: number | string, token = owner.token) =>
    api<{ error?: string }>(`/expense-categories/${id}`, { token, method: 'DELETE' });
  const tree = (token = owner.token) => api<ExpenseCategoryNode[]>('/expense-categories', { token });

  async function insertExpense(categoryId: number, deleted = false): Promise<void> {
    await env.DB.prepare(
      `INSERT INTO expenses (date, amount_cents, category_id, payment_method, deleted_at)
       VALUES ('2026-03-10', 1000, ?, 'efectivo', ${deleted ? "datetime('now')" : 'NULL'})`,
    )
      .bind(categoryId)
      .run();
  }

  it('anónimo 401 y cajero 403 en todas las rutas', async () => {
    for (const [method, path] of [
      ['GET', '/expense-categories'],
      ['POST', '/expense-categories'],
      ['PATCH', '/expense-categories/1'],
      ['DELETE', '/expense-categories/1'],
    ] as const) {
      expect((await api(path, { method })).status, `${method} anon`).toBe(401);
      expect((await api(path, { method, token: cashier.token, body: method === 'GET' ? undefined : {} })).status, `${method} cashier`).toBe(403);
    }
  });

  describe('GET /', () => {
    it('devuelve el árbol con conteo de uso (sin contar eliminados) y las hijas anidadas', async () => {
      const parent = await create({ name: 'Arbol padre' });
      const child = await create({ name: 'Arbol hija', parentId: parent.body.id });
      await insertExpense(child.body.id);
      await insertExpense(child.body.id);
      await insertExpense(child.body.id, true);

      const res = await tree(admin.token);
      expect(res.status).toBe(200);
      const node = res.body.find((c) => c.id === parent.body.id)!;
      expect(node).toMatchObject({ name: 'Arbol padre', parentId: null, expenseCount: 0 });
      expect(node.children).toHaveLength(1);
      expect(node.children[0]).toMatchObject({ id: child.body.id, expenseCount: 2, parentId: parent.body.id, children: [] });
      // Las 9 categorías del seed siguen presentes como raíces.
      expect(res.body.map((c) => c.name)).toEqual(expect.arrayContaining(['Insumos', 'Gas', 'Otros']));
    });

    it('incluye las desactivadas (pantalla de administración)', async () => {
      const cat = await create({ name: 'Arbol inactiva', isActive: false });
      expect(cat.body.isActive).toBe(false);
      expect((await tree()).body.some((c) => c.id === cat.body.id && !c.isActive)).toBe(true);
    });
  });

  describe('POST /', () => {
    it('crea una raíz con color y devuelve 201', async () => {
      const res = await create({ name: '  Publicidad  ', color: '#FF8800' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'Publicidad', parentId: null, color: '#FF8800', isActive: true });
    });

    it('rechaza nombre vacío, color inválido, padre inexistente o que ya es hija (400)', async () => {
      const root = await create({ name: 'Raiz dos niveles' });
      const child = await create({ name: 'Hija dos niveles', parentId: root.body.id });
      for (const body of [
        { name: '   ' },
        { name: 'X', color: 'rojo' },
        { name: 'X', parentId: 999_999 },
        { name: 'Nieta', parentId: child.body.id },
      ]) {
        expect((await create(body)).status, JSON.stringify(body)).toBe(400);
      }
    });

    it('nombre duplicado: 409 en raíz y dentro del mismo padre; permitido bajo otro padre', async () => {
      const a = await create({ name: 'Padre A' });
      const b = await create({ name: 'Padre B' });
      expect((await create({ name: 'Padre A' })).status).toBe(409);
      expect((await create({ name: 'Mismo', parentId: a.body.id })).status).toBe(201);
      expect((await create({ name: 'Mismo', parentId: a.body.id })).status).toBe(409);
      expect((await create({ name: 'Mismo', parentId: b.body.id })).status).toBe(201);
    });
  });

  it('la DB acepta #RRGGBB y rechaza colores mal formados (CHECK dentro del límite de 50 bytes de GLOB en D1)', async () => {
    const insert = (color: string) =>
      env.DB.prepare('INSERT INTO expense_categories (name, color) VALUES (?, ?)').bind(`chk-${color}`, color).run();
    await expect(insert('#aBc123')).resolves.toBeDefined();
    for (const bad of ['#abc12', '#abc1234', 'abc1234', '#abcxyz']) {
      await expect(insert(bad), bad).rejects.toThrow();
    }
  });

  it('no admite gastos nuevos en una subcategoría cuyo padre está desactivado (400)', async () => {
    const parent = await create({ name: 'Padre apagado' });
    const child = await create({ name: 'Hija de apagado', parentId: parent.body.id });
    await patch(parent.body.id, { isActive: false });
    const res = await api('/expenses', {
      token: owner.token,
      method: 'POST',
      body: { date: '2026-03-10', amountCents: 100, categoryId: child.body.id, paymentMethod: 'efectivo' },
    });
    expect(res.status).toBe(400);
  });

  describe('PATCH /:id', () => {
    it('renombra, cambia color y activa/desactiva; mantiene lo no enviado', async () => {
      const cat = await create({ name: 'Para editar', color: '#112233' });
      const renamed = await patch(cat.body.id, { name: 'Editada' });
      expect(renamed.body).toMatchObject({ name: 'Editada', color: '#112233', isActive: true });
      const off = await patch(cat.body.id, { isActive: false, color: null });
      expect(off.body).toMatchObject({ name: 'Editada', color: null, isActive: false });
    });

    it('400 con body vacío o inválido y 404 si no existe', async () => {
      const cat = await create({ name: 'Validaciones' });
      expect((await patch(cat.body.id, {})).status).toBe(400);
      expect((await patch(cat.body.id, { name: '' })).status).toBe(400);
      expect((await patch('abc', { name: 'x' })).status).toBe(400);
      expect((await patch(999_999, { name: 'x' })).status).toBe(404);
    });

    it('renombrar a un nombre existente da 409', async () => {
      await create({ name: 'Existente' });
      const other = await create({ name: 'Otra' });
      expect((await patch(other.body.id, { name: 'Existente' })).status).toBe(409);
    });

    it('valida mover de padre: no a sí misma, no bajo una hija, no con hijas propias', async () => {
      const p = await create({ name: 'Mover padre' });
      const c = await create({ name: 'Mover hija', parentId: p.body.id });
      const solo = await create({ name: 'Mover sola' });
      expect((await patch(p.body.id, { parentId: p.body.id })).status).toBe(400);
      expect((await patch(solo.body.id, { parentId: c.body.id })).status).toBe(400);
      expect((await patch(p.body.id, { parentId: solo.body.id })).status).toBe(400);
      const moved = await patch(c.body.id, { parentId: solo.body.id });
      expect(moved.body.parentId).toBe(solo.body.id);
      const rooted = await patch(c.body.id, { parentId: null });
      expect(rooted.body.parentId).toBeNull();
    });
  });

  describe('DELETE /:id', () => {
    it('elimina una categoría sin gastos ni hijas', async () => {
      const cat = await create({ name: 'Para borrar' });
      expect((await remove(cat.body.id)).status).toBe(200);
      expect((await tree()).body.some((c) => c.id === cat.body.id)).toBe(false);
      expect((await remove(cat.body.id)).status).toBe(404);
    });

    it('409 si tiene gastos (incluso eliminados) y sugiere desactivar', async () => {
      const cat = await create({ name: 'Con gastos' });
      await insertExpense(cat.body.id, true);
      const res = await remove(cat.body.id, admin.token);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/desact/i);
    });

    it('409 si tiene subcategorías', async () => {
      const p = await create({ name: 'Con hijas' });
      await create({ name: 'Hija de borrar', parentId: p.body.id });
      const res = await remove(p.body.id);
      expect(res.status).toBe(409);
    });

    it('400 con id inválido', async () => {
      expect((await remove('abc')).status).toBe(400);
    });
  });
});
