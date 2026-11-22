import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CashSession, CashSessionDetail, PaginatedResult, Sale } from '@sabor/shared';
import {
  api,
  createUser,
  openCash,
  resetPos,
  seedMenu,
  type MenuFixture,
  type TestUser,
} from '../../test/pos-fixtures';
import { env } from 'cloudflare:workers';

describe('routes/cash-sessions', () => {
  let owner: TestUser;
  let admin: TestUser;
  let cashier: TestUser;
  let menu: MenuFixture;

  beforeAll(async () => {
    owner = await createUser('cs-owner@test.local', 'owner');
    admin = await createUser('cs-admin@test.local', 'admin');
    cashier = await createUser('cs-cashier@test.local', 'cashier');
    menu = await seedMenu();
  });

  beforeEach(resetPos);

  async function sell(token: string, items: Array<{ itemId: number; sizeId?: number; quantity: number }>, method = 'efectivo') {
    const res = await api<Sale>('/sales', {
      token,
      method: 'POST',
      body: { clientUuid: crypto.randomUUID(), items, paymentMethod: method },
    });
    expect(res.status).toBe(201);
    return res.body;
  }

  describe('GET /current', () => {
    it('rechaza sin token (401)', async () => {
      expect((await api('/cash-sessions/current')).status).toBe(401);
    });

    it('devuelve null si no hay caja abierta', async () => {
      const res = await api('/cash-sessions/current', { token: cashier.token });
      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it('devuelve la sesión abierta con su resumen en vivo', async () => {
      await openCash(cashier.token, 5_000);
      await sell(cashier.token, [{ itemId: menu.gaseosa, quantity: 2 }]);
      const res = await api<CashSessionDetail>('/cash-sessions/current', { token: cashier.token });
      expect(res.status).toBe(200);
      expect(res.body.closedAt).toBeNull();
      expect(res.body.summary.salesCount).toBe(1);
      expect(res.body.summary.totalSalesCents).toBe(1_100);
      expect(res.body.summary.expectedCashCents).toBe(6_100);
    });
  });

  describe('POST / (abrir)', () => {
    it('el cajero puede abrir caja (201)', async () => {
      const res = await api<CashSession>('/cash-sessions', {
        token: cashier.token,
        method: 'POST',
        body: { openingCashCents: 20_000, notes: 'Turno noche' },
      });
      expect(res.status).toBe(201);
      expect(res.body.openingCashCents).toBe(20_000);
      expect(res.body.openedBy).toBe(cashier.id);
      expect(res.body.closedAt).toBeNull();
    });

    it('rechaza abrir una segunda caja (409)', async () => {
      await openCash(cashier.token);
      const res = await api('/cash-sessions', { token: admin.token, method: 'POST', body: { openingCashCents: 0 } });
      expect(res.status).toBe(409);
    });

    it('rechaza montos negativos o no enteros (400)', async () => {
      for (const openingCashCents of [-1, 10.5]) {
        const res = await api('/cash-sessions', { token: cashier.token, method: 'POST', body: { openingCashCents } });
        expect(res.status).toBe(400);
      }
    });

    it('rechaza sin token (401)', async () => {
      expect((await api('/cash-sessions', { method: 'POST', body: { openingCashCents: 0 } })).status).toBe(401);
    });
  });

  describe('POST /:id/close', () => {
    it('calcula esperado = apertura + efectivo − gastos de caja y guarda el snapshot', async () => {
      const id = await openCash(cashier.token, 10_000);
      await sell(cashier.token, [{ itemId: menu.pizza, sizeId: menu.sizeGrande, quantity: 2 }]); // 60.00 efectivo
      await sell(cashier.token, [{ itemId: menu.gaseosa, quantity: 1 }], 'yape'); // 5.50 yape
      const anulada = await sell(cashier.token, [{ itemId: menu.gaseosa, quantity: 1 }]); // se anula
      await api(`/sales/${anulada.id}/void`, { token: cashier.token, method: 'POST', body: { reason: 'Error de digitación' } });
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO expenses (date, amount_cents, category_id, payment_method, paid_from_register, session_id)
           VALUES ('2026-11-22', 1500, 1, 'efectivo', 1, ?)`,
        ).bind(id),
        // No descuenta: no salió de caja ni está en esta sesión.
        env.DB.prepare(
          `INSERT INTO expenses (date, amount_cents, category_id, payment_method, paid_from_register, session_id)
           VALUES ('2026-11-22', 9999, 1, 'efectivo', 0, ?)`,
        ).bind(id),
        env.DB.prepare(
          `INSERT INTO expenses (date, amount_cents, category_id, payment_method, paid_from_register, session_id, deleted_at)
           VALUES ('2026-11-22', 7777, 1, 'efectivo', 1, ?, datetime('now'))`,
        ).bind(id),
      ]);

      const res = await api<CashSessionDetail>(`/cash-sessions/${id}/close`, {
        token: cashier.token,
        method: 'POST',
        body: { countedCashCents: 14_000, notes: 'Cierre normal' },
      });

      expect(res.status).toBe(200);
      expect(res.body.closedBy).toBe(cashier.id);
      expect(res.body.expectedCashCents).toBe(10_000 + 6_000 - 1_500);
      expect(res.body.countedCashCents).toBe(14_000);
      const snap = res.body.closeSnapshot!;
      expect(snap.salesCount).toBe(2);
      expect(snap.voidedCount).toBe(1);
      expect(snap.totalSalesCents).toBe(6_550);
      expect(snap.cashExpensesCents).toBe(1_500);
      expect(snap.differenceCents).toBe(14_000 - 14_500);
      expect(snap.byMethod.map((m) => [m.paymentMethod, m.salesCount, m.totalCents])).toEqual([
        ['efectivo', 1, 6_000],
        ['yape', 1, 550],
      ]);
      expect(snap.topProducts[0]).toMatchObject({ quantity: 2, totalCents: 6_000 });
      expect(res.body.summary.expectedCashCents).toBe(14_500);
    });

    it('limita topProducts a 10', async () => {
      const id = await openCash(cashier.token, 0);
      for (let i = 0; i < 12; i += 1) {
        const item = await env.DB.prepare(
          "INSERT INTO menu_items (category_id, slug, name_es, price) VALUES ((SELECT id FROM categories WHERE slug='bebidas'), ?, ?, 1) RETURNING id",
        )
          .bind(`top-${id}-${i}-${crypto.randomUUID()}`, `Top ${i}`)
          .first<{ id: number }>();
        await sell(cashier.token, [{ itemId: item!.id, quantity: 1 }]);
      }
      const res = await api<CashSession>(`/cash-sessions/${id}/close`, {
        token: cashier.token,
        method: 'POST',
        body: { countedCashCents: 0 },
      });
      expect(res.body.closeSnapshot!.topProducts).toHaveLength(10);
    });

    it('rechaza cerrar una sesión ya cerrada (409)', async () => {
      const id = await openCash(cashier.token);
      const body = { countedCashCents: 10_000 };
      expect((await api(`/cash-sessions/${id}/close`, { token: cashier.token, method: 'POST', body })).status).toBe(200);
      expect((await api(`/cash-sessions/${id}/close`, { token: cashier.token, method: 'POST', body })).status).toBe(409);
    });

    it('404 si la sesión no existe y 400 si el id es inválido', async () => {
      expect((await api('/cash-sessions/9999/close', { token: cashier.token, method: 'POST', body: { countedCashCents: 0 } })).status).toBe(404);
      expect((await api('/cash-sessions/abc/close', { token: cashier.token, method: 'POST', body: { countedCashCents: 0 } })).status).toBe(400);
    });

    it('exige countedCashCents entero >= 0 (400)', async () => {
      const id = await openCash(cashier.token);
      for (const countedCashCents of [-5, 1.5, undefined]) {
        const res = await api(`/cash-sessions/${id}/close`, { token: cashier.token, method: 'POST', body: { countedCashCents } });
        expect(res.status).toBe(400);
      }
    });

    it('tras cerrar ya se puede abrir otra caja y no se vende en la cerrada', async () => {
      const id = await openCash(cashier.token);
      await api(`/cash-sessions/${id}/close`, { token: cashier.token, method: 'POST', body: { countedCashCents: 10_000 } });
      const sale = await api('/sales', {
        token: cashier.token,
        method: 'POST',
        body: { clientUuid: crypto.randomUUID(), items: [{ itemId: menu.gaseosa, quantity: 1 }], paymentMethod: 'yape' },
      });
      expect(sale.status).toBe(409);
      expect((await api('/cash-sessions', { token: cashier.token, method: 'POST', body: { openingCashCents: 0 } })).status).toBe(201);
    });
  });

  describe('GET / y GET /:id', () => {
    it('lista paginada para owner/admin y 403 para el cajero', async () => {
      const id = await openCash(cashier.token);
      await api(`/cash-sessions/${id}/close`, { token: cashier.token, method: 'POST', body: { countedCashCents: 10_000 } });
      await openCash(owner.token);

      for (const staff of [owner, admin]) {
        const res = await api<PaginatedResult<CashSession>>('/cash-sessions?pageSize=1', { token: staff.token });
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(2);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0]!.closedAt).toBeNull(); // más reciente primero
      }
      expect((await api('/cash-sessions', { token: cashier.token })).status).toBe(403);
    });

    it('detalle con snapshot (cerrada) o resumen en vivo (abierta)', async () => {
      const closedId = await openCash(cashier.token, 1_000);
      await api(`/cash-sessions/${closedId}/close`, { token: cashier.token, method: 'POST', body: { countedCashCents: 1_000 } });
      const openId = await openCash(cashier.token, 2_000);

      const closed = await api<CashSessionDetail>(`/cash-sessions/${closedId}`, { token: admin.token });
      expect(closed.status).toBe(200);
      expect(closed.body.closeSnapshot?.countedCashCents).toBe(1_000);
      expect(closed.body.summary.expectedCashCents).toBe(1_000);

      const live = await api<CashSessionDetail>(`/cash-sessions/${openId}`, { token: admin.token });
      expect(live.body.closeSnapshot).toBeNull();
      expect(live.body.summary.openingCashCents).toBe(2_000);
    });

    it('el cajero ve la sesión abierta y la que él mismo cerró hace poco', async () => {
      const closedId = await openCash(cashier.token);
      await api(`/cash-sessions/${closedId}/close`, { token: cashier.token, method: 'POST', body: { countedCashCents: 10_000 } });
      const openId = await openCash(cashier.token);
      const closed = await api<CashSessionDetail>(`/cash-sessions/${closedId}`, { token: cashier.token });
      expect(closed.status).toBe(200);
      expect(closed.body.closeSnapshot?.countedCashCents).toBe(10_000);
      expect((await api(`/cash-sessions/${openId}`, { token: cashier.token })).status).toBe(200);
    });

    it('el cajero no ve una caja cerrada por otra persona (403)', async () => {
      const id = await openCash(owner.token);
      await api(`/cash-sessions/${id}/close`, { token: owner.token, method: 'POST', body: { countedCashCents: 10_000 } });
      expect((await api(`/cash-sessions/${id}`, { token: cashier.token })).status).toBe(403);
    });

    it('el cajero no ve su propio cierre pasadas 12 h (403)', async () => {
      const id = await openCash(cashier.token);
      await api(`/cash-sessions/${id}/close`, { token: cashier.token, method: 'POST', body: { countedCashCents: 10_000 } });
      await env.DB.prepare("UPDATE cash_sessions SET closed_at = datetime('now', '-13 hours') WHERE id = ?").bind(id).run();
      expect((await api(`/cash-sessions/${id}`, { token: cashier.token })).status).toBe(403);
      expect((await api(`/cash-sessions/${id}`, { token: admin.token })).status).toBe(200);
    });

    it('404 si no existe', async () => {
      expect((await api('/cash-sessions/9999', { token: owner.token })).status).toBe(404);
    });
  });
});
