import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MenuItem, Sale } from '@sabor/shared';
import { api, createUser, openCash, resetPos, type TestUser } from '../../test/pos-fixtures';

/**
 * Sabores y notas por línea (0011): el servidor tasa con la regla del sabor
 * más caro y el adicional por categoría de las promos, valida los sabores y
 * guarda el snapshot. Carta con los precios reales del seed (Grande):
 * Clásicas 35 · Especiales 37 · De la Casa 43; Promo 2 Grandes = 80.
 */
interface Fixture {
  grande: number;
  mediana: number;
  hawaiana: number;
  pepperoni: number;
  araguaney: number;
  llanera: number;
  llaneraOff: number;
  llaneraWeb: number;
  promo2Grandes: number;
  gaseosa: number;
}

async function id(sql: string, ...params: unknown[]): Promise<number> {
  const row = await env.DB.prepare(`${sql} RETURNING id`).bind(...params).first<{ id: number }>();
  return row!.id;
}

async function seed(): Promise<Fixture> {
  const mediana = await id("INSERT INTO sizes (key, label_es, label_en, display_order) VALUES ('mediana', 'Mediana', 'Medium', 1)");
  const grande = await id("INSERT INTO sizes (key, label_es, label_en, display_order) VALUES ('grande', 'Grande', 'Large', 2)");
  const cat = async (slug: string, name: string, m: number | null, g: number) => {
    const categoryId = await id('INSERT INTO categories (slug, name_es, has_sizes) VALUES (?, ?, 1)', slug, name);
    if (m !== null) await env.DB.prepare('INSERT INTO category_prices (category_id, size_id, price) VALUES (?, ?, ?)').bind(categoryId, mediana, m).run();
    await env.DB.prepare('INSERT INTO category_prices (category_id, size_id, price) VALUES (?, ?, ?)').bind(categoryId, grande, g).run();
    return categoryId;
  };
  const clasicas = await cat('clasicas', 'Pizzas Clásicas', 25, 35);
  const especiales = await cat('especiales', 'Pizzas Especiales', 27, 37);
  const casa = await cat('de-la-casa', 'Pizzas de la Casa', null, 43);
  const promos = await id("INSERT INTO categories (slug, name_es, has_sizes) VALUES ('promos', 'Promociones', 0)");
  const bebidas = await id("INSERT INTO categories (slug, name_es, has_sizes) VALUES ('bebidas', 'Bebidas', 0)");
  const item = (categoryId: number, slug: string, name: string, price: number | null, channel = 'both', active = 1) =>
    id('INSERT INTO menu_items (category_id, slug, name_es, price, channel, is_active) VALUES (?, ?, ?, ?, ?, ?)', categoryId, slug, name, price, channel, active);
  const promo2Grandes = await item(promos, 'promo-2-grandes', 'Promo 2 Pizzas Grandes', 80);
  await env.DB.prepare('UPDATE menu_items SET promo_pizza_count = 2, promo_pizza_size_id = ? WHERE id = ?').bind(grande, promo2Grandes).run();
  return {
    grande,
    mediana,
    hawaiana: await item(clasicas, 'hawaiana', 'Hawaiana', null),
    pepperoni: await item(clasicas, 'pepperoni', 'Pepperoni', null),
    araguaney: await item(especiales, 'araguaney', 'Araguaney', null),
    llanera: await item(casa, 'llanera', 'Llanera', null),
    llaneraOff: await item(casa, 'llanera-off', 'Llanera vieja', null, 'both', 0),
    llaneraWeb: await item(casa, 'llanera-web', 'Llanera web', null, 'web'),
    promo2Grandes,
    gaseosa: await item(bebidas, 'gaseosa', 'Gaseosa', 5),
  };
}

type Line = { itemId: number; sizeId?: number; quantity: number; flavors?: number[][]; note?: string };

describe('ventas con sabores y notas', () => {
  let cashier: TestUser;
  let owner: TestUser;
  let f: Fixture;

  beforeAll(async () => {
    cashier = await createUser('flavors-cashier@test.local', 'cashier');
    owner = await createUser('flavors-owner@test.local', 'owner');
    f = await seed();
  });

  beforeEach(async () => {
    await resetPos();
    await openCash(cashier.token);
  });

  const sell = (items: Line[]) =>
    api<Sale & { error?: string }>('/sales', {
      token: cashier.token,
      method: 'POST',
      body: { clientUuid: crypto.randomUUID(), paymentMethod: 'yape', items },
    });

  it('pizza Hawaiana + Llanera Grande: cobra el precio de Llanera y guarda sabores y nota', async () => {
    const res = await sell([
      { itemId: f.hawaiana, sizeId: f.grande, quantity: 2, flavors: [[f.hawaiana, f.llanera]], note: '  sin   cebolla ' },
    ]);
    expect(res.status).toBe(201);
    const [line] = res.body.items;
    expect(line).toMatchObject({ unitPriceCents: 4300, lineTotalCents: 8600, note: 'sin cebolla' });
    expect(line?.flavors).toEqual({
      kind: 'pizza',
      pizzas: [
        {
          flavors: [
            { itemId: f.hawaiana, name: 'Hawaiana' },
            { itemId: f.llanera, name: 'Llanera' },
          ],
          pricedBy: { itemId: f.llanera, name: 'Llanera' },
          categoryName: 'Pizzas de la Casa',
          surchargeCents: 0,
        },
      ],
    });
    expect(res.body.totalCents).toBe(8600);
  });

  it('promo: todas Clásicas = precio normal; con Especial y De la Casa suma +2 y +8', async () => {
    const res = await sell([
      { itemId: f.promo2Grandes, quantity: 1, flavors: [[f.hawaiana], [f.pepperoni]] },
      { itemId: f.promo2Grandes, quantity: 1, flavors: [[f.araguaney], [f.hawaiana, f.llanera]] },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.items.map((item) => item.unitPriceCents)).toEqual([8000, 9000]);
    expect(res.body.items[1]?.flavors?.pizzas.map((p) => p.surchargeCents)).toEqual([200, 800]);
    expect(res.body.totalCents).toBe(17000);
  });

  it('el mismo producto con distintos sabores o nota son líneas distintas (no se fusionan)', async () => {
    const res = await sell([
      { itemId: f.hawaiana, sizeId: f.grande, quantity: 1 },
      { itemId: f.hawaiana, sizeId: f.grande, quantity: 1, note: 'bien cocida' },
      { itemId: f.hawaiana, sizeId: f.grande, quantity: 1, flavors: [[f.hawaiana, f.pepperoni]] },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(3);
  });

  it('una línea igual repetida sigue siendo 400', async () => {
    const line = { itemId: f.hawaiana, sizeId: f.grande, quantity: 1, note: 'x' };
    expect((await sell([line, line])).status).toBe(400);
  });

  it('la venta simple no cambia: sin sabores ni nota → null', async () => {
    const res = await sell([{ itemId: f.gaseosa, quantity: 1 }]);
    expect(res.status).toBe(201);
    expect(res.body.items[0]).toMatchObject({ unitPriceCents: 500, flavors: null, note: null });
  });

  it.each([
    ['sabor inactivo', () => [{ itemId: f.hawaiana, sizeId: f.grande, quantity: 1, flavors: [[f.hawaiana, f.llaneraOff]] }]],
    ['sabor solo-web', () => [{ itemId: f.hawaiana, sizeId: f.grande, quantity: 1, flavors: [[f.hawaiana, f.llaneraWeb]] }]],
    ['sabor que no es pizza', () => [{ itemId: f.hawaiana, sizeId: f.grande, quantity: 1, flavors: [[f.hawaiana, f.gaseosa]] }]],
    ['sabor sin precio en el tamaño', () => [{ itemId: f.hawaiana, sizeId: f.mediana, quantity: 1, flavors: [[f.hawaiana, f.llanera]] }]],
    ['exceso de sabores', () => [{ itemId: f.hawaiana, sizeId: f.grande, quantity: 1, flavors: [[f.hawaiana, f.pepperoni, f.llanera]] }]],
    ['promo con pizzas de menos', () => [{ itemId: f.promo2Grandes, quantity: 1, flavors: [[f.hawaiana]] }]],
    ['producto que no admite sabores', () => [{ itemId: f.gaseosa, quantity: 1, flavors: [[f.hawaiana]] }]],
    ['nota demasiado larga', () => [{ itemId: f.gaseosa, quantity: 1, note: 'a'.repeat(201) }]],
    ['nota de 205 caracteres', () => [{ itemId: f.gaseosa, quantity: 1, note: 'b'.repeat(205) }]],
  ])('rechaza %s (400) sin registrar la venta', async (_label, build) => {
    const res = await sell(build() as Line[]);
    expect(res.status).toBe(400);
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM sales').first<{ n: number }>();
    expect(count?.n).toBe(0);
  });

  it('sanea la nota (control/bidi fuera) y el detalle se devuelve en GET /sales/:id', async () => {
    const res = await sell([{ itemId: f.gaseosa, quantity: 1, note: 'helada‮<script>' }]);
    expect(res.status).toBe(201);
    const detail = await api<Sale>(`/sales/${res.body.id}`, { token: cashier.token });
    expect(detail.body.items[0]?.note).toBe('helada <script>');
  });

  it('el menú expone y deja editar la configuración de la promo', async () => {
    const res = await api<MenuItem & { error?: string }>(`/menu-items/${f.promo2Grandes}`, {
      token: owner.token,
      method: 'PATCH',
      body: { promoPizzaCount: 1, promoPizzaSizeId: f.mediana },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ promoPizzaCount: 1, promoPizzaSizeId: f.mediana });
    const invalid = await api(`/menu-items/${f.hawaiana}`, {
      token: owner.token,
      method: 'PATCH',
      body: { promoPizzaCount: 2, promoPizzaSizeId: f.grande },
    });
    expect(invalid.status).toBe(400);
    await env.DB.prepare('UPDATE menu_items SET promo_pizza_count = 2, promo_pizza_size_id = ? WHERE id = ?').bind(f.grande, f.promo2Grandes).run();
  });
});
