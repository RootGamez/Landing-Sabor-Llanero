import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import type { MenuItem, PaginatedResult, PaymentMethod } from '@sabor/shared';
import { api, createUser, seedMenu, type MenuFixture, type TestUser } from '../../test/pos-fixtures';

interface Section {
  items: Array<{ id: number; slug?: string }>;
}

describe('acceso del cajero y canal del menú', () => {
  let owner: TestUser;
  let cashier: TestUser;
  let menu: MenuFixture;

  beforeAll(async () => {
    owner = await createUser('acc-owner@test.local', 'owner');
    cashier = await createUser('acc-cashier@test.local', 'cashier');
    menu = await seedMenu();
  });

  describe('GET /payment-methods', () => {
    it('exige sesión de staff (401 anónimo)', async () => {
      expect((await api('/payment-methods')).status).toBe(401);
    });

    it('el cajero lee los métodos activos ordenados', async () => {
      const res = await api<PaymentMethod[]>('/payment-methods', { token: cashier.token });
      expect(res.status).toBe(200);
      expect(res.body.map((m) => m.key)).toEqual(['efectivo', 'yape', 'plin', 'tarjeta', 'transferencia']);
    });
  });

  describe('el cajero no entra al back-office (403)', () => {
    const forbidden: Array<[string, string, unknown?]> = [
      ['GET', '/reports/order-clicks'],
      ['GET', '/reports/by-category'],
      ['GET', '/orders'],
      ['PATCH', '/orders/1', { status: 'confirmed' }],
      ['PUT', '/orders/1/items', { items: [] }],
      ['GET', '/users'],
      ['POST', '/users', {}],
      ['POST', '/categories', {}],
      ['PATCH', '/categories/1', {}],
      ['POST', '/menu-items', {}],
      ['PATCH', '/menu-items/1', {}],
      ['DELETE', '/menu-items/1'],
      ['GET', '/collections/all'],
      ['PATCH', '/sizes/1', {}],
      ['PATCH', '/whatsapp', {}],
      ['GET', '/raffle/entries'],
      ['POST', '/rewards', {}],
      ['PATCH', '/loyalty-config', {}],
      ['GET', '/expenses'],
      ['POST', '/expenses', {}],
      ['PATCH', '/expenses/1', {}],
      ['DELETE', '/expenses/1'],
      ['GET', '/expense-categories'],
      ['POST', '/expense-categories', {}],
      ['PATCH', '/expense-categories/1', {}],
      ['DELETE', '/expense-categories/1'],
      ['POST', '/imports/homebank/preview', {}],
      ['POST', '/imports/homebank/commit', {}],
    ];

    it.each(forbidden)('%s %s', async (method, path, body) => {
      const res = await api(path, { token: cashier.token, method, body });
      expect(res.status).toBe(403);
    });
  });

  describe('canal del menú (D6)', () => {
    it('la web pública solo ve ítems both/web', async () => {
      const list = await api<PaginatedResult<MenuItem>>('/menu-items?pageSize=100');
      const ids = list.body.items.map((i) => i.id);
      expect(ids).toContain(menu.pizza);
      expect(ids).toContain(menu.pizzaWebOnly);
      expect(ids).not.toContain(menu.pizzaPosOnly);
      expect(ids).not.toContain(menu.gaseosaPosOnly);

      const sections = await api<Section[]>('/menu-items/sections?limit=24');
      const sectionIds = sections.body.flatMap((s) => s.items.map((i) => i.id));
      expect(sectionIds).toContain(menu.gaseosa);
      expect(sectionIds).not.toContain(menu.gaseosaPosOnly);
      expect(sectionIds).not.toContain(menu.pizzaPosOnly);
    });

    it('el detalle público por slug no expone ítems solo-POS (404)', async () => {
      expect((await api('/menu-items/gaseosa-pos')).status).toBe(404);
      expect((await api('/menu-items/gaseosa')).status).toBe(200);
    });

    it('el cajero pide el menú del POS con channel=pos (both + pos)', async () => {
      const sections = await api<Section[]>('/menu-items/sections?channel=pos&limit=24', { token: cashier.token });
      expect(sections.status).toBe(200);
      const ids = sections.body.flatMap((s) => s.items.map((i) => i.id));
      expect(ids).toContain(menu.pizza);
      expect(ids).toContain(menu.pizzaPosOnly);
      expect(ids).toContain(menu.gaseosaPosOnly);
      expect(ids).not.toContain(menu.pizzaWebOnly);
    });

    it('el POS no tiene tope de 24 por categoría; la web pública sí', async () => {
      const cat = await env.DB.prepare(
        "INSERT INTO categories (slug, name_es, has_sizes) VALUES ('bulk', 'Bulk', 0) RETURNING id",
      ).first<{ id: number }>();
      const inserts = Array.from({ length: 30 }, (_, i) =>
        env.DB.prepare(
          "INSERT INTO menu_items (category_id, slug, name_es, price, channel, is_active) VALUES (?, ?, ?, 1, 'both', 1)",
        ).bind(cat!.id, `bulk-${i}`, `Bulk ${i}`),
      );
      await env.DB.batch(inserts);
      const countBulk = (sections: Section[]) =>
        sections.filter((s) => s.items.some((i) => i.slug?.startsWith('bulk-')))
          .flatMap((s) => s.items).length;

      const pos = await api<Section[]>('/menu-items/sections?channel=pos&limit=200', { token: cashier.token });
      expect(countBulk(pos.body)).toBe(30);
      const web = await api<Section[]>('/menu-items/sections?limit=200');
      expect(countBulk(web.body)).toBe(24);
    });

    it('channel=pos y channel=all exigen sesión de staff (401 anónimo)', async () => {
      expect((await api('/menu-items?channel=pos')).status).toBe(401);
      expect((await api('/menu-items/sections?channel=all')).status).toBe(401);
    });

    it('channel=all (CMS) devuelve todos los canales y channel inválido da 400', async () => {
      const all = await api<PaginatedResult<MenuItem>>('/menu-items?channel=all&pageSize=100', { token: owner.token });
      const ids = all.body.items.map((i) => i.id);
      expect(ids).toContain(menu.pizzaWebOnly);
      expect(ids).toContain(menu.pizzaPosOnly);
      expect((await api('/menu-items?channel=zzz', { token: owner.token })).status).toBe(400);
    });

    it('las colecciones públicas omiten ítems solo-POS', async () => {
      const col = await env.DB.prepare('SELECT id FROM collections LIMIT 1').first<{ id: number }>();
      await env.DB.batch([
        env.DB.prepare('UPDATE collections SET is_active = 1 WHERE id = ?').bind(col!.id),
        env.DB.prepare('INSERT INTO collection_items (collection_id, item_id) VALUES (?, ?)').bind(col!.id, menu.gaseosaPosOnly),
        env.DB.prepare('INSERT INTO collection_items (collection_id, item_id) VALUES (?, ?)').bind(col!.id, menu.gaseosa),
      ]);
      const res = await api<Array<{ items: Array<{ id: number; slug?: string }> }>>('/collections');
      const ids = res.body.flatMap((c) => c.items.map((i) => i.id));
      expect(ids).toContain(menu.gaseosa);
      expect(ids).not.toContain(menu.gaseosaPosOnly);
    });
  });
});
