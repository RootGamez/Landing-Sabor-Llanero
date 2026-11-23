import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CashSessionDetail, DiningTab, DiningTable, DiningTableStatus, Sale } from '@sabor/shared';
import { api, createUser, openCash, seedMenu, type MenuFixture, type TestUser } from '../../test/pos-fixtures';

type ErrorBody = { error?: string };

/** Deja mesas (plano por defecto), cuentas, ventas y caja en blanco entre tests. */
async function resetAll(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM dining_tab_items'),
    env.DB.prepare('DELETE FROM dining_tabs'),
    env.DB.prepare("DELETE FROM dining_tables WHERE label NOT IN ('1','2','3','4','5')"),
    env.DB.prepare('UPDATE dining_tables SET is_active = 1'),
    env.DB.prepare('DELETE FROM sale_items'),
    env.DB.prepare('DELETE FROM sales'),
    env.DB.prepare('DELETE FROM cash_sessions'),
  ]);
}

async function countSales(): Promise<number> {
  return (await env.DB.prepare('SELECT COUNT(*) AS n FROM sales').first<{ n: number }>())!.n;
}

describe('routes/tables + /tables/:id/tab', () => {
  let owner: TestUser;
  let admin: TestUser;
  let cashier: TestUser;
  let menu: MenuFixture;
  let mesa1: number;

  beforeAll(async () => {
    owner = await createUser('mesas-owner@test.local', 'owner');
    admin = await createUser('mesas-admin@test.local', 'admin');
    cashier = await createUser('mesas-cashier@test.local', 'cashier');
    menu = await seedMenu();
    mesa1 = (await env.DB.prepare("SELECT id FROM dining_tables WHERE label = '1'").first<{ id: number }>())!.id;
  });

  beforeEach(resetAll);

  const saveTab = (token: string, tableId: number, expectedVersion: number | null, items: unknown[]) =>
    api<DiningTab & ErrorBody>(`/tables/${tableId}/tab`, { token, method: 'PUT', body: { expectedVersion, items } });

  const closeTab = (token: string, tableId: number, body: Record<string, unknown>) =>
    api<Sale & ErrorBody>(`/tables/${tableId}/tab/close`, { token, method: 'POST', body });

  const pizzaGrande = (quantity: number) => ({ itemId: menu.pizza, sizeId: menu.sizeGrande, quantity });
  const gaseosa = (quantity: number) => ({ itemId: menu.gaseosa, quantity });

  describe('plano', () => {
    it('la migración siembra el plano por defecto del dibujo (3-2-1 a la izquierda, 4-5 a la derecha)', async () => {
      const res = await api<DiningTableStatus[]>('/tables', { token: cashier.token });
      expect(res.status).toBe(200);
      const byLabel = Object.fromEntries(res.body.map((t) => [t.label, t]));
      expect(Object.keys(byLabel).sort()).toEqual(['1', '2', '3', '4', '5']);
      expect(byLabel['3']!.y).toBeLessThan(byLabel['2']!.y);
      expect(byLabel['2']!.y).toBeLessThan(byLabel['1']!.y);
      expect(byLabel['4']!.x).toBeGreaterThan(byLabel['1']!.x + byLabel['1']!.w);
      expect(byLabel['4']!.w).toBeLessThan(byLabel['1']!.w);
      expect(res.body.every((t) => t.openTab === null)).toBe(true);
    });

    it('rechaza sin token (401) y el cajero no edita el plano (403)', async () => {
      expect((await api('/tables')).status).toBe(401);
      const created = await api('/tables', { token: cashier.token, method: 'POST', body: { label: '6', x: 10, y: 0, w: 2, h: 2 } });
      expect(created.status).toBe(403);
      const patched = await api(`/tables/${mesa1}`, { token: cashier.token, method: 'PATCH', body: { label: 'X' } });
      expect(patched.status).toBe(403);
    });

    it('owner/admin crean, mueven y renombran; se validan solapes, límites y nombres repetidos', async () => {
      const created = await api<DiningTable>('/tables', { token: admin.token, method: 'POST', body: { label: 'Barra', x: 10, y: 0, w: 2, h: 2 } });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ label: 'Barra', shape: 'rect', isActive: true });

      const overlap = await api<ErrorBody>('/tables', { token: owner.token, method: 'POST', body: { label: '7', x: 2, y: 1, w: 2, h: 2 } });
      expect(overlap.status).toBe(409);
      expect(overlap.body.error).toContain('Mesa 3');
      const outside = await api('/tables', { token: owner.token, method: 'POST', body: { label: '7', x: 11, y: 0, w: 2, h: 1 } });
      expect(outside.status).toBe(400);
      const duplicate = await api('/tables', { token: owner.token, method: 'POST', body: { label: 'barra', x: 10, y: 4, w: 1, h: 1 } });
      expect(duplicate.status).toBe(409);

      const moved = await api<DiningTable>(`/tables/${created.body.id}`, { token: owner.token, method: 'PATCH', body: { y: 3, shape: 'round' } });
      expect(moved.status).toBe(200);
      expect(moved.body).toMatchObject({ y: 3, shape: 'round' });
    });

    it('no deja desactivar una mesa con cuenta abierta; libre sí, y desaparece del mapa del cajero', async () => {
      await saveTab(cashier.token, mesa1, null, [gaseosa(1)]);
      const blocked = await api(`/tables/${mesa1}`, { token: owner.token, method: 'PATCH', body: { isActive: false } });
      expect(blocked.status).toBe(409);

      const mesa2 = (await env.DB.prepare("SELECT id FROM dining_tables WHERE label = '2'").first<{ id: number }>())!.id;
      expect((await api(`/tables/${mesa2}`, { token: owner.token, method: 'PATCH', body: { isActive: false } })).status).toBe(200);
      const map = await api<DiningTableStatus[]>('/tables', { token: cashier.token });
      expect(map.body.map((t) => t.label)).not.toContain('2');
      const all = await api<DiningTableStatus[]>('/tables?all=1', { token: owner.token });
      expect(all.body.map((t) => t.label)).toContain('2');
      expect((await saveTab(cashier.token, mesa2, null, [gaseosa(1)])).status).toBe(409);
    });
  });

  describe('guardar pedido', () => {
    it('abre la cuenta con precios del servidor y NO genera venta ni ingreso', async () => {
      await openCash(cashier.token);
      const res = await saveTab(cashier.token, mesa1, null, [pizzaGrande(2), gaseosa(1)]);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'open', version: 1, totalCents: 6_000 + 550, itemCount: 3 });

      expect(await countSales()).toBe(0);
      const current = await api<CashSessionDetail>('/cash-sessions/current', { token: cashier.token });
      expect(current.body.summary.totalSalesCents).toBe(0);
      expect(current.body.summary.salesCount).toBe(0);

      const map = await api<DiningTableStatus[]>('/tables', { token: cashier.token });
      expect(map.body.find((t) => t.id === mesa1)!.openTab).toMatchObject({ totalCents: 6_550, itemCount: 3, version: 1 });
    });

    it('acepta tandas sucesivas, conserva el precio guardado y rechaza versiones viejas (409)', async () => {
      const first = await saveTab(cashier.token, mesa1, null, [gaseosa(1)]);
      await env.DB.prepare('UPDATE menu_items SET price = 9 WHERE id = ?').bind(menu.gaseosa).run();
      const second = await saveTab(cashier.token, mesa1, first.body.version, [gaseosa(2), pizzaGrande(1)]);
      await env.DB.prepare('UPDATE menu_items SET price = 5.5 WHERE id = ?').bind(menu.gaseosa).run();
      expect(second.status).toBe(200);
      expect(second.body.version).toBe(2);
      expect(second.body.totalCents).toBe(2 * 550 + 3_000);

      const stale = await saveTab(admin.token, mesa1, first.body.version, [gaseosa(5)]);
      expect(stale.status).toBe(409);
    });

    it('una mesa solo tiene UNA cuenta abierta, incluso con dos dispositivos a la vez', async () => {
      const [a, b] = await Promise.all([
        saveTab(cashier.token, mesa1, null, [gaseosa(1)]),
        saveTab(admin.token, mesa1, null, [gaseosa(2)]),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM dining_tabs WHERE status = 'open'").first<{ n: number }>();
      expect(open!.n).toBe(1);
      const again = await saveTab(cashier.token, mesa1, null, [gaseosa(1)]);
      expect(again.status).toBe(409);
    });

    it('el cajero no reduce lo ya guardado (403); el admin sí', async () => {
      const opened = await saveTab(cashier.token, mesa1, null, [gaseosa(3), pizzaGrande(1)]);
      expect((await saveTab(cashier.token, mesa1, opened.body.version, [gaseosa(2), pizzaGrande(1)])).status).toBe(403);
      expect((await saveTab(cashier.token, mesa1, opened.body.version, [gaseosa(3)])).status).toBe(403);
      const reduced = await saveTab(admin.token, mesa1, opened.body.version, [gaseosa(1)]);
      expect(reduced.status).toBe(200);
      expect(reduced.body.items).toHaveLength(1);
      expect(reduced.body.totalCents).toBe(550);
    });

    it('rechaza productos solo-web o inactivos sin abrir la cuenta', async () => {
      const res = await saveTab(cashier.token, mesa1, null, [{ itemId: menu.pizzaWebOnly, sizeId: menu.sizeGrande, quantity: 1 }]);
      expect(res.status).toBe(400);
      expect((await api(`/tables/${mesa1}/tab`, { token: cashier.token })).body).toBeNull();
    });
  });

  describe('cerrar mesa (cobrar)', () => {
    it('exige caja abierta', async () => {
      const tab = await saveTab(cashier.token, mesa1, null, [gaseosa(2)]);
      const res = await closeTab(cashier.token, mesa1, { tabId: tab.body.id, expectedVersion: tab.body.version });
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Abre la caja');
    });

    it('crea la venta, libera la mesa y recién ahí cuenta como ingreso', async () => {
      await openCash(cashier.token);
      const tab = await saveTab(cashier.token, mesa1, null, [pizzaGrande(1), gaseosa(2)]);
      const res = await closeTab(cashier.token, mesa1, {
        tabId: tab.body.id,
        expectedVersion: tab.body.version,
        paymentMethod: 'efectivo',
        cashReceivedCents: 5_000,
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ totalCents: 4_100, paymentMethod: 'efectivo', changeCents: 900 });
      expect(res.body.items).toHaveLength(2);

      const map = await api<DiningTableStatus[]>('/tables', { token: cashier.token });
      expect(map.body.find((t) => t.id === mesa1)!.openTab).toBeNull();
      const current = await api<CashSessionDetail>('/cash-sessions/current', { token: cashier.token });
      expect(current.body.summary.totalSalesCents).toBe(4_100);
      const row = await env.DB.prepare('SELECT status, sale_id FROM dining_tabs WHERE id = ?').bind(tab.body.id).first();
      expect(row).toMatchObject({ status: 'paid', sale_id: res.body.id });
    });

    it('es idempotente: cobrar dos veces (o a la vez) no duplica la venta', async () => {
      await openCash(cashier.token);
      const tab = await saveTab(cashier.token, mesa1, null, [gaseosa(2)]);
      const body = { tabId: tab.body.id, expectedVersion: tab.body.version };
      const [a, b] = await Promise.all([closeTab(cashier.token, mesa1, body), closeTab(admin.token, mesa1, body)]);
      expect([a.status, b.status].sort()).toEqual([200, 201]);
      expect(a.body.id).toBe(b.body.id);
      const retry = await closeTab(cashier.token, mesa1, body);
      expect(retry.status).toBe(200);
      expect(retry.body.id).toBe(a.body.id);
      expect(await countSales()).toBe(1);
    });

    it('rechaza cobrar una versión vieja y descuentos del cajero', async () => {
      await openCash(cashier.token);
      const tab = await saveTab(cashier.token, mesa1, null, [gaseosa(1)]);
      await saveTab(cashier.token, mesa1, tab.body.version, [gaseosa(3)]);
      expect((await closeTab(cashier.token, mesa1, { tabId: tab.body.id, expectedVersion: tab.body.version })).status).toBe(409);
      expect(
        (await closeTab(cashier.token, mesa1, { tabId: tab.body.id, expectedVersion: tab.body.version + 1, discountCents: 100 })).status,
      ).toBe(403);
      const withDiscount = await closeTab(owner.token, mesa1, { tabId: tab.body.id, expectedVersion: tab.body.version + 1, discountCents: 150 });
      expect(withDiscount.status).toBe(201);
      expect(withDiscount.body.totalCents).toBe(3 * 550 - 150);
      expect(await countSales()).toBe(1);
    });

    it('no cobra la cuenta de otra mesa', async () => {
      await openCash(cashier.token);
      const tab = await saveTab(cashier.token, mesa1, null, [gaseosa(1)]);
      const mesa2 = (await env.DB.prepare("SELECT id FROM dining_tables WHERE label = '2'").first<{ id: number }>())!.id;
      expect((await closeTab(cashier.token, mesa2, { tabId: tab.body.id, expectedVersion: 1 })).status).toBe(404);
    });
  });

  describe('anular cuenta', () => {
    it('solo owner/admin; libera la mesa sin venta y es idempotente', async () => {
      await openCash(cashier.token);
      const tab = await saveTab(cashier.token, mesa1, null, [gaseosa(2)]);
      const body = { tabId: tab.body.id, reason: 'Se fueron sin pedir' };
      expect((await api(`/tables/${mesa1}/tab/void`, { token: cashier.token, method: 'POST', body })).status).toBe(403);

      const voided = await api<DiningTab>(`/tables/${mesa1}/tab/void`, { token: admin.token, method: 'POST', body });
      expect(voided.status).toBe(200);
      expect(voided.body.status).toBe('void');
      expect((await api(`/tables/${mesa1}/tab/void`, { token: admin.token, method: 'POST', body })).status).toBe(200);

      expect((await api(`/tables/${mesa1}/tab`, { token: cashier.token })).body).toBeNull();
      expect(await countSales()).toBe(0);
      expect((await closeTab(owner.token, mesa1, { tabId: tab.body.id, expectedVersion: tab.body.version })).status).toBe(409);
      // La mesa queda libre para una cuenta nueva.
      expect((await saveTab(cashier.token, mesa1, null, [gaseosa(1)])).status).toBe(201);
    });
  });

  describe('sabores y notas en la cuenta (0011)', () => {
    it('guarda sabores y nota por línea, los devuelve al recargar y el cobro los copia a la venta', async () => {
      await openCash(cashier.token);
      const mitad = { ...pizzaGrande(1), flavors: [[menu.pizza, menu.pizzaPosOnly]], note: 'sin cebolla' };
      const saved = await saveTab(cashier.token, mesa1, null, [mitad, pizzaGrande(1)]);
      expect(saved.status).toBe(201);
      expect(saved.body.items).toHaveLength(2);
      const flavored = saved.body.items.find((item) => item.note === 'sin cebolla');
      expect(flavored?.flavors?.pizzas[0]?.flavors.map((f) => f.itemId)).toEqual([menu.pizza, menu.pizzaPosOnly]);

      const reloaded = await api<DiningTab>(`/tables/${mesa1}/tab`, { token: cashier.token });
      expect(reloaded.body.items.find((item) => item.note === 'sin cebolla')?.flavors?.kind).toBe('pizza');

      // Reenviar lo mismo no cambia nada (misma identidad con sabores + nota).
      const same = await saveTab(cashier.token, mesa1, saved.body.version, [mitad, pizzaGrande(1)]);
      expect(same.status).toBe(200);
      expect(same.body.version).toBe(saved.body.version);

      const paid = await closeTab(cashier.token, mesa1, { tabId: saved.body.id, expectedVersion: saved.body.version, paymentMethod: 'yape' });
      expect(paid.status).toBe(201);
      const line = paid.body.items.find((item) => item.note === 'sin cebolla');
      expect(line?.flavors?.pizzas[0]?.flavors).toHaveLength(2);
      expect(paid.body.items.find((item) => item.note === null)?.flavors).toBeNull();
    });

    it('cambiar la nota de una línea guardada es reducir lo guardado: solo owner/admin', async () => {
      const first = await saveTab(cashier.token, mesa1, null, [{ ...pizzaGrande(1), note: 'bien cocida' }]);
      const asCashier = await saveTab(cashier.token, mesa1, first.body.version, [{ ...pizzaGrande(1), note: 'poco cocida' }]);
      expect(asCashier.status).toBe(403);
      const asOwner = await saveTab(owner.token, mesa1, first.body.version, [{ ...pizzaGrande(1), note: 'poco cocida' }]);
      expect(asOwner.status).toBe(200);
      expect(asOwner.body.items.map((item) => item.note)).toEqual(['poco cocida']);
    });
  });
});
