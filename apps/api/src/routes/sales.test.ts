import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PaginatedResult, PendingWebOrder, Sale } from '@sabor/shared';
import {
  api,
  createConfirmedOrder,
  createUser,
  openCash,
  resetPos,
  seedMenu,
  type MenuFixture,
  type TestUser,
} from '../../test/pos-fixtures';

type SaleBody = {
  clientUuid?: string;
  items?: Array<{ itemId: number; sizeId?: number; quantity: number }>;
  paymentMethod?: string;
  discountCents?: number;
  cashReceivedCents?: number;
  orderId?: number;
};

describe('routes/sales', () => {
  let owner: TestUser;
  let admin: TestUser;
  let cashier: TestUser;
  let cashier2: TestUser;
  let menu: MenuFixture;

  beforeAll(async () => {
    owner = await createUser('sales-owner@test.local', 'owner');
    admin = await createUser('sales-admin@test.local', 'admin');
    cashier = await createUser('sales-cashier@test.local', 'cashier');
    cashier2 = await createUser('sales-cashier2@test.local', 'cashier');
    menu = await seedMenu();
  });

  beforeEach(resetPos);

  const postSale = (token: string | undefined, body: SaleBody) =>
    api<Sale & { error?: string }>('/sales', {
      token,
      method: 'POST',
      body: { clientUuid: crypto.randomUUID(), paymentMethod: 'efectivo', ...body },
    });

  describe('POST / (crear)', () => {
    it('rechaza sin token (401)', async () => {
      expect((await postSale(undefined, { items: [{ itemId: menu.gaseosa, quantity: 1 }] })).status).toBe(401);
    });

    it('rechaza vender sin caja abierta (409)', async () => {
      const res = await postSale(cashier.token, { items: [{ itemId: menu.gaseosa, quantity: 1 }] });
      expect(res.status).toBe(409);
    });

    it('recalcula precios server-side e ignora los que manda el cliente', async () => {
      await openCash(cashier.token);
      const res = await api<Sale>('/sales', {
        token: cashier.token,
        method: 'POST',
        body: {
          clientUuid: crypto.randomUUID(),
          paymentMethod: 'yape',
          totalCents: 1,
          unitPriceCents: 1,
          items: [
            { itemId: menu.pizza, sizeId: menu.sizeGrande, quantity: 2, unitPriceCents: 1 },
            { itemId: menu.gaseosa, quantity: 3 },
          ],
        },
      });
      expect(res.status).toBe(201);
      expect(res.body.subtotalCents).toBe(6_000 + 1_650);
      expect(res.body.totalCents).toBe(7_650);
      expect(res.body.paymentMethod).toBe('yape');
      expect(res.body.createdBy).toBe(cashier.id);
      expect(res.body.items).toHaveLength(2);
      const pizza = res.body.items.find((i) => i.itemId === menu.pizza)!;
      expect(pizza).toMatchObject({ unitPriceCents: 3_000, quantity: 2, lineTotalCents: 6_000, sizeLabel: 'Grande' });
    });

    it('usa el override de precio del ítem sobre el de la categoría', async () => {
      await env.DB.prepare('INSERT INTO item_prices (item_id, size_id, price) VALUES (?, ?, 27.9)')
        .bind(menu.pizza, menu.sizeMediana)
        .run();
      await openCash(cashier.token);
      const res = await postSale(cashier.token, { items: [{ itemId: menu.pizza, sizeId: menu.sizeMediana, quantity: 1 }] });
      expect(res.body.items[0]!.unitPriceCents).toBe(2_790);
      await env.DB.prepare('DELETE FROM item_prices').run();
    });

    it('numera correlativamente por sesión', async () => {
      const first = await openCash(cashier.token);
      const a = await postSale(cashier.token, { items: [{ itemId: menu.gaseosa, quantity: 1 }] });
      const b = await postSale(cashier.token, { items: [{ itemId: menu.gaseosa, quantity: 1 }] });
      expect([a.body.number, b.body.number]).toEqual([1, 2]);
      expect(a.body.sessionId).toBe(first);
      await api(`/cash-sessions/${first}/close`, { token: cashier.token, method: 'POST', body: { countedCashCents: 0 } });
      await openCash(cashier.token);
      const c = await postSale(cashier.token, { items: [{ itemId: menu.gaseosa, quantity: 1 }] });
      expect(c.body.number).toBe(1);
    });

    it('es idempotente por clientUuid: el reintento devuelve la misma venta (200) sin duplicar', async () => {
      await openCash(cashier.token);
      const body = { clientUuid: crypto.randomUUID(), items: [{ itemId: menu.gaseosa, quantity: 2 }] };
      const first = await postSale(cashier.token, body);
      const retry = await postSale(cashier.token, body);
      expect(first.status).toBe(201);
      expect(retry.status).toBe(200);
      expect(retry.body.id).toBe(first.body.id);
      expect(retry.body.items).toHaveLength(1);
      const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM sales').first<{ n: number }>();
      expect(count!.n).toBe(1);
    });

    it('el reintento sigue siendo idempotente aunque la caja ya se haya cerrado', async () => {
      const id = await openCash(cashier.token);
      const body = { clientUuid: crypto.randomUUID(), items: [{ itemId: menu.gaseosa, quantity: 1 }] };
      const first = await postSale(cashier.token, body);
      await api(`/cash-sessions/${id}/close`, { token: cashier.token, method: 'POST', body: { countedCashCents: 0 } });
      const retry = await postSale(cashier.token, body);
      expect(retry.status).toBe(200);
      expect(retry.body.id).toBe(first.body.id);
      const lines = await env.DB.prepare('SELECT COUNT(*) AS n FROM sale_items').first<{ n: number }>();
      expect(lines!.n).toBe(1);
    });

    it('dos peticiones concurrentes con el mismo clientUuid crean una sola venta', async () => {
      await openCash(cashier.token);
      const body = { clientUuid: crypto.randomUUID(), items: [{ itemId: menu.gaseosa, quantity: 1 }] };
      const [a, b] = await Promise.all([postSale(cashier.token, body), postSale(cashier.token, body)]);
      expect([a.status, b.status].sort()).toEqual([200, 201]);
      expect(a.body.id).toBe(b.body.id);
      const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM sales').first<{ n: number }>();
      expect(count!.n).toBe(1);
    });

    it('ventas concurrentes distintas reciben números distintos', async () => {
      await openCash(cashier.token);
      const results = await Promise.all(
        Array.from({ length: 4 }, () => postSale(cashier.token, { items: [{ itemId: menu.gaseosa, quantity: 1 }] })),
      );
      expect(results.every((r) => r.status === 201)).toBe(true);
      expect(results.map((r) => r.body.number).sort()).toEqual([1, 2, 3, 4]);
    });

    it('rechaza ítems inactivos, solo-web, inexistentes o sin sizeId (400)', async () => {
      await openCash(cashier.token);
      const invalid: SaleBody[] = [
        { items: [{ itemId: menu.pizzaInactive, sizeId: menu.sizeGrande, quantity: 1 }] },
        { items: [{ itemId: menu.pizzaWebOnly, sizeId: menu.sizeGrande, quantity: 1 }] },
        { items: [{ itemId: 99_999, quantity: 1 }] },
        { items: [{ itemId: menu.pizza, quantity: 1 }] },
        { items: [{ itemId: menu.gaseosa, sizeId: menu.sizeGrande, quantity: 1 }] },
        { items: [{ itemId: menu.gaseosa, quantity: 0 }] },
        { items: [] },
      ];
      for (const body of invalid) {
        expect((await postSale(cashier.token, body)).status, JSON.stringify(body)).toBe(400);
      }
    });

    it('permite ítems solo-POS', async () => {
      await openCash(cashier.token);
      const res = await postSale(cashier.token, { items: [{ itemId: menu.gaseosaPosOnly, quantity: 2 }] });
      expect(res.status).toBe(201);
      expect(res.body.totalCents).toBe(600);
    });

    it('valida el método de pago contra payment_methods (400)', async () => {
      await openCash(cashier.token);
      const items = [{ itemId: menu.gaseosa, quantity: 1 }];
      expect((await postSale(cashier.token, { items, paymentMethod: 'bitcoin' })).status).toBe(400);
      await env.DB.prepare("UPDATE payment_methods SET is_active = 0 WHERE key = 'plin'").run();
      expect((await postSale(cashier.token, { items, paymentMethod: 'plin' })).status).toBe(400);
      await env.DB.prepare("UPDATE payment_methods SET is_active = 1 WHERE key = 'plin'").run();
    });

    it('efectivo: guarda lo recibido y calcula vuelto; rechaza recibido menor al total', async () => {
      await openCash(cashier.token);
      const items = [{ itemId: menu.gaseosa, quantity: 2 }]; // 11.00
      const ok = await postSale(cashier.token, { items, cashReceivedCents: 2_000 });
      expect(ok.status).toBe(201);
      expect(ok.body.cashReceivedCents).toBe(2_000);
      expect(ok.body.changeCents).toBe(900);
      expect((await postSale(cashier.token, { items, cashReceivedCents: 1_099 })).status).toBe(400);
    });

    it('cashReceivedCents solo aplica a efectivo (400 en otros métodos)', async () => {
      await openCash(cashier.token);
      const res = await postSale(cashier.token, {
        items: [{ itemId: menu.gaseosa, quantity: 1 }],
        paymentMethod: 'yape',
        cashReceivedCents: 1_000,
      });
      expect(res.status).toBe(400);
    });

    it('aplica descuento a nivel venta y rechaza uno mayor al subtotal (400)', async () => {
      await openCash(cashier.token);
      const items = [{ itemId: menu.gaseosa, quantity: 2 }]; // 11.00
      const ok = await postSale(cashier.token, { items, discountCents: 100 });
      expect(ok.body).toMatchObject({ subtotalCents: 1_100, discountCents: 100, totalCents: 1_000 });
      expect((await postSale(cashier.token, { items, discountCents: 1_101 })).status).toBe(400);
    });

    it('el admin y el owner también pueden vender', async () => {
      await openCash(owner.token);
      for (const staff of [admin, owner]) {
        expect((await postSale(staff.token, { items: [{ itemId: menu.gaseosa, quantity: 1 }] })).status).toBe(201);
      }
    });
  });

  describe('POST / con orderId (cobrar pedido web)', () => {
    it('toma ítems y total del pedido, enlaza la venta y no deja cobrarlo dos veces', async () => {
      await openCash(cashier.token);
      const orderId = await createConfirmedOrder(menu.pizza, 28.9, 2); // 57.80
      const res = await postSale(cashier.token, { orderId, paymentMethod: 'yape' });
      expect(res.status).toBe(201);
      expect(res.body.orderId).toBe(orderId);
      expect(res.body.totalCents).toBe(5_780);
      expect(res.body.items[0]).toMatchObject({ unitPriceCents: 2_890, quantity: 2, sizeLabel: 'Grande' });

      const again = await postSale(cashier.token, { orderId, paymentMethod: 'efectivo' });
      expect(again.status).toBe(409);
    });

    it('rechaza pedidos pendientes o inexistentes (409/404)', async () => {
      await openCash(cashier.token);
      const pending = await createConfirmedOrder(menu.pizza, 10, 1, 'pending');
      expect((await postSale(cashier.token, { orderId: pending })).status).toBe(409);
      expect((await postSale(cashier.token, { orderId: 99_999 })).status).toBe(404);
    });

    it('con orderId ignora los items del cliente: manda el pedido', async () => {
      await openCash(cashier.token);
      const confirmed = await createConfirmedOrder(menu.pizza, 10, 1);
      const res = await postSale(cashier.token, { orderId: confirmed, items: [{ itemId: menu.gaseosa, quantity: 9 }] });
      expect(res.status).toBe(201);
      expect(res.body.totalCents).toBe(1_000);
      expect(res.body.items).toHaveLength(1);
    });

    it('anular la venta libera el pedido para volver a cobrarlo', async () => {
      await openCash(cashier.token);
      const orderId = await createConfirmedOrder(menu.pizza, 20, 1);
      const sale = await postSale(cashier.token, { orderId, paymentMethod: 'efectivo' });
      await api(`/sales/${sale.body.id}/void`, { token: cashier.token, method: 'POST', body: { reason: 'Método equivocado' } });
      expect((await postSale(cashier.token, { orderId, paymentMethod: 'yape' })).status).toBe(201);
    });
  });

  describe('GET /pending-web-orders', () => {
    it('lista pedidos confirmados sin cobrar, con total en céntimos', async () => {
      await openCash(cashier.token);
      const toCharge = await createConfirmedOrder(menu.pizza, 25, 2);
      const charged = await createConfirmedOrder(menu.pizza, 10, 1);
      await createConfirmedOrder(menu.pizza, 10, 1, 'pending');
      await postSale(cashier.token, { orderId: charged });

      const res = await api<PendingWebOrder[]>('/sales/pending-web-orders', { token: cashier.token });
      expect(res.status).toBe(200);
      const ids = res.body.map((o) => o.id);
      expect(ids).toContain(toCharge);
      expect(ids).not.toContain(charged);
      expect(res.body.every((o) => o.status === 'confirmed')).toBe(true);
      expect(res.body.find((o) => o.id === toCharge)).toMatchObject({ totalCents: 5_000 });
      expect(res.body.find((o) => o.id === toCharge)!.items).toHaveLength(1);
    });

    it('exige autenticación (401)', async () => {
      expect((await api('/sales/pending-web-orders')).status).toBe(401);
    });
  });

  describe('POST /:id/void', () => {
    it('exige motivo (400)', async () => {
      await openCash(cashier.token);
      const sale = await postSale(cashier.token, { items: [{ itemId: menu.gaseosa, quantity: 1 }] });
      for (const reason of ['', '   ', undefined]) {
        const res = await api(`/sales/${sale.body.id}/void`, { token: cashier.token, method: 'POST', body: { reason } });
        expect(res.status).toBe(400);
      }
    });

    it('anula con motivo y deja trazabilidad; no se puede anular dos veces (409)', async () => {
      await openCash(cashier.token);
      const sale = await postSale(cashier.token, { items: [{ itemId: menu.gaseosa, quantity: 1 }] });
      const res = await api<Sale>(`/sales/${sale.body.id}/void`, {
        token: cashier.token,
        method: 'POST',
        body: { reason: 'Cliente se arrepintió' },
      });
      expect(res.status).toBe(200);
      expect(res.body.voidedAt).not.toBeNull();
      expect(res.body.voidedBy).toBe(cashier.id);
      expect(res.body.voidReason).toBe('Cliente se arrepintió');
      const again = await api(`/sales/${sale.body.id}/void`, { token: cashier.token, method: 'POST', body: { reason: 'otra vez' } });
      expect(again.status).toBe(409);
    });

    it('cajero y admin no anulan ventas de una sesión cerrada (403); el owner sí', async () => {
      const id = await openCash(cashier.token);
      const sale = await postSale(cashier.token, { items: [{ itemId: menu.gaseosa, quantity: 1 }] });
      await api(`/cash-sessions/${id}/close`, { token: cashier.token, method: 'POST', body: { countedCashCents: 0 } });
      for (const staff of [cashier, admin]) {
        const res = await api(`/sales/${sale.body.id}/void`, { token: staff.token, method: 'POST', body: { reason: 'tarde' } });
        expect(res.status).toBe(403);
      }
      const ok = await api(`/sales/${sale.body.id}/void`, { token: owner.token, method: 'POST', body: { reason: 'Corrección contable' } });
      expect(ok.status).toBe(200);
    });

    it('el admin puede anular mientras la caja siga abierta', async () => {
      await openCash(cashier.token);
      const sale = await postSale(cashier.token, { items: [{ itemId: menu.gaseosa, quantity: 1 }] });
      const res = await api(`/sales/${sale.body.id}/void`, { token: admin.token, method: 'POST', body: { reason: 'Duplicada' } });
      expect(res.status).toBe(200);
    });

    it('404 si no existe', async () => {
      const res = await api('/sales/99999/void', { token: owner.token, method: 'POST', body: { reason: 'x' } });
      expect(res.status).toBe(404);
    });
  });

  describe('GET / y GET /:id', () => {
    it('lista paginada con filtro por sesión e incluye anuladas', async () => {
      const first = await openCash(cashier.token);
      const a = await postSale(cashier.token, { items: [{ itemId: menu.gaseosa, quantity: 1 }] });
      await postSale(cashier.token, { items: [{ itemId: menu.gaseosa, quantity: 2 }] });
      await api(`/sales/${a.body.id}/void`, { token: cashier.token, method: 'POST', body: { reason: 'Prueba' } });
      await api(`/cash-sessions/${first}/close`, { token: cashier.token, method: 'POST', body: { countedCashCents: 0 } });
      const second = await openCash(cashier.token);
      await postSale(cashier.token, { items: [{ itemId: menu.gaseosa, quantity: 3 }] });

      const all = await api<PaginatedResult<Sale>>('/sales', { token: owner.token });
      expect(all.body.total).toBe(3);
      const firstOnly = await api<PaginatedResult<Sale>>(`/sales?session_id=${first}`, { token: admin.token });
      expect(firstOnly.body.total).toBe(2);
      expect(firstOnly.body.items.some((s) => s.voidedAt !== null)).toBe(true);
      expect(firstOnly.body.items.every((s) => s.items.length === 1)).toBe(true);
      const page = await api<PaginatedResult<Sale>>(`/sales?session_id=${second}&pageSize=1&page=1`, { token: owner.token });
      expect(page.body).toMatchObject({ total: 1, pageSize: 1 });
    });

    it('filtra por fecha local de Lima (UTC-5)', async () => {
      await openCash(cashier.token);
      const sale = await postSale(cashier.token, { items: [{ itemId: menu.gaseosa, quantity: 1 }] });
      // 2026-03-10 02:30 UTC = 2026-03-09 21:30 en Lima.
      await env.DB.prepare("UPDATE sales SET created_at = '2026-03-10 02:30:00' WHERE id = ?").bind(sale.body.id).run();

      const lima9 = await api<PaginatedResult<Sale>>('/sales?from=2026-03-09&to=2026-03-09', { token: owner.token });
      expect(lima9.body.total).toBe(1);
      const lima10 = await api<PaginatedResult<Sale>>('/sales?from=2026-03-10&to=2026-03-10', { token: owner.token });
      expect(lima10.body.total).toBe(0);
    });

    it('rechaza fechas o session_id inválidos (400)', async () => {
      for (const qs of ['from=ayer', 'to=2026-02-30', 'session_id=abc', 'from=2026-03-10&to=2026-03-01']) {
        expect((await api(`/sales?${qs}`, { token: owner.token })).status, qs).toBe(400);
      }
    });

    it('el cajero solo ve las ventas de la caja abierta', async () => {
      const first = await openCash(cashier.token);
      const old = await postSale(cashier.token, { items: [{ itemId: menu.gaseosa, quantity: 1 }] });
      await api(`/cash-sessions/${first}/close`, { token: cashier.token, method: 'POST', body: { countedCashCents: 0 } });
      const second = await openCash(cashier2.token);
      const current = await postSale(cashier2.token, { items: [{ itemId: menu.gaseosa, quantity: 1 }] });

      const list = await api<PaginatedResult<Sale>>('/sales', { token: cashier.token });
      expect(list.body.items.map((s) => s.id)).toEqual([current.body.id]);
      expect((await api(`/sales?session_id=${first}`, { token: cashier.token })).status).toBe(403);
      expect((await api('/sales?from=2026-01-01', { token: cashier.token })).status).toBe(403);
      expect((await api(`/sales?session_id=${second}`, { token: cashier.token })).status).toBe(200);
      expect((await api(`/sales/${old.body.id}`, { token: cashier.token })).status).toBe(403);
      expect((await api(`/sales/${current.body.id}`, { token: cashier.token })).status).toBe(200);
    });

    it('detalle por id con sus líneas y 404 si no existe', async () => {
      await openCash(cashier.token);
      const sale = await postSale(cashier.token, { items: [{ itemId: menu.gaseosa, quantity: 1 }] });
      const res = await api<Sale>(`/sales/${sale.body.id}`, { token: owner.token });
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect((await api('/sales/99999', { token: owner.token })).status).toBe(404);
      expect((await api('/sales/abc', { token: owner.token })).status).toBe(400);
    });
  });
});
