import { env, exports } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  Category,
  DiningTab,
  MenuItem,
  MenuItemDetail,
  OrderDto,
  Sale,
  Size,
} from '@sabor/shared';
import { api, createUser, openCash, seedMenu, type MenuFixture, type TestUser } from '../../test/pos-fixtures';
import { signCustomerToken } from '../lib/jwt';

/**
 * Presentaciones por ítem (0012): un ítem de una categoría SIN tamaños (ej.
 * Tequeños) se vende como Media docena / 1 docena / Docena y media / 2 docenas,
 * cada una con su precio por ítem, reutilizando sizes/item_prices/sizeId.
 */

type ErrorBody = { error?: string };
type SectionBody = Array<{ category: Category; items: Array<MenuItem & { price: number | null; prices: PriceBody[] }> }>;
interface PriceBody {
  sizeId: number;
  sizeKey: string;
  price: number;
  isOverride: boolean;
  kind?: string;
  units?: number | null;
  labelEs?: string;
}

const app = exports.default;
const PORTION_PRICES = { media_docena: 20, docena: 36, docena_y_media: 52, dos_docenas: 70 } as const;
type PortionKey = keyof typeof PORTION_PRICES;

async function portionIds(): Promise<Record<PortionKey, number>> {
  const { results } = await env.DB.prepare("SELECT id, key FROM sizes WHERE kind = 'portion'").all<{ id: number; key: string }>();
  return Object.fromEntries(results.map((r) => [r.key, r.id])) as Record<PortionKey, number>;
}

async function createCustomer(): Promise<string> {
  const email = `portion-${crypto.randomUUID()}@test.local`;
  const row = await env.DB.prepare(
    "INSERT INTO customers (email, phone, password_hash, name) VALUES (?, '999111222', 'x', 'Cliente') RETURNING id",
  )
    .bind(email)
    .first<{ id: number }>();
  return signCustomerToken({ customerId: row!.id, email }, env.CUSTOMER_JWT_SECRET, 0);
}

async function customerOrder(token: string, items: unknown[]): Promise<{ status: number; body: OrderDto & ErrorBody }> {
  const res = await app.fetch('https://example.com/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ items }),
  });
  return { status: res.status, body: (await res.json()) as OrderDto & ErrorBody };
}

describe('presentaciones por ítem', () => {
  let owner: TestUser;
  let admin: TestUser;
  let cashier: TestUser;
  let menu: MenuFixture;
  let portion: Record<PortionKey, number>;
  let entradasId: number;
  let tequenos: number;
  let simple: number;

  const overridesFor = (keys: PortionKey[] = Object.keys(PORTION_PRICES) as PortionKey[]) =>
    keys.map((key) => ({ sizeId: portion[key], price: PORTION_PRICES[key] }));

  async function createEntrada(slug: string, body: Record<string, unknown> = {}) {
    return api<MenuItem & ErrorBody>('/menu-items', {
      token: owner.token,
      method: 'POST',
      body: { categoryId: entradasId, nameEs: slug, slug, price: 36, ...body },
    });
  }

  beforeAll(async () => {
    owner = await createUser('portions-owner@test.local', 'owner');
    admin = await createUser('portions-admin@test.local', 'admin');
    cashier = await createUser('portions-cashier@test.local', 'cashier');
    menu = await seedMenu();
    portion = await portionIds();
    const entradas = await env.DB.prepare(
      "INSERT INTO categories (slug, name_es, has_sizes) VALUES ('entradas', 'Entradas', 0) RETURNING id",
    ).first<{ id: number }>();
    entradasId = entradas!.id;
    const created = await createEntrada('tequenos', { nameEs: 'Tequeños', priceOverrides: overridesFor() });
    tequenos = created.body.id;
    simple = (await createEntrada('yuca-frita', { nameEs: 'Yuca frita', price: 15 })).body.id;
  });

  describe('GET /sizes', () => {
    it('lista tamaños y presentaciones con kind y units', async () => {
      const res = await api<Size[]>('/sizes');
      expect(res.status).toBe(200);
      const docena = res.body.find((s) => s.key === 'docena');
      expect(docena).toMatchObject({ kind: 'portion', units: 12, labelEs: '1 docena', labelEn: '1 dozen' });
      const mediana = res.body.find((s) => s.key === 'mediana');
      expect(mediana).toMatchObject({ kind: 'size', units: null });
    });
  });

  describe('categorías de pizzas siguen funcionando con las 4 presentaciones en sizes (regresión)', () => {
    const pricesFor = (extra: Array<{ sizeId: number; price: number }> = []) => [
      { sizeId: menu.sizeMediana, price: 25 },
      { sizeId: menu.sizeGrande, price: 35 },
      ...extra,
    ];

    it('crear una categoría con tamaños pide cobertura solo de los tamaños (no de las presentaciones)', async () => {
      const res = await api<Category & ErrorBody>('/categories', {
        token: owner.token,
        method: 'POST',
        body: { slug: 'clasicas', nameEs: 'Clásicas', hasSizes: true, prices: pricesFor() },
      });
      expect(res.status).toBe(201);
    });

    it('faltar un tamaño real sigue siendo 400 y el mensaje no menciona presentaciones', async () => {
      const res = await api<ErrorBody>('/categories', {
        token: owner.token,
        method: 'POST',
        body: { slug: 'incompleta', nameEs: 'Incompleta', hasSizes: true, prices: [{ sizeId: menu.sizeMediana, price: 25 }] },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Grande');
      expect(res.body.error).not.toContain('docena');
    });

    it('un precio de categoría con una presentación se rechaza (400)', async () => {
      const res = await api<ErrorBody>('/categories', {
        token: owner.token,
        method: 'POST',
        body: {
          slug: 'mezcla',
          nameEs: 'Mezcla',
          hasSizes: true,
          prices: pricesFor([{ sizeId: portion.docena, price: 10 }]),
        },
      });
      expect(res.status).toBe(400);
    });

    it('editar precios de una categoría existente (PUT /prices y PATCH) funciona', async () => {
      const cat = await api<Category>('/categories', {
        token: owner.token,
        method: 'POST',
        body: { slug: 'especiales', nameEs: 'Especiales', hasSizes: true, prices: pricesFor() },
      });
      const put = await api(`/categories/${cat.body.id}/prices`, {
        token: owner.token,
        method: 'PUT',
        body: { prices: [{ sizeId: menu.sizeMediana, price: 27 }, { sizeId: menu.sizeGrande, price: 37 }] },
      });
      expect(put.status).toBe(200);
      const patch = await api(`/categories/${cat.body.id}`, {
        token: owner.token,
        method: 'PATCH',
        body: { prices: pricesFor() },
      });
      expect(patch.status).toBe(200);
    });

    it('promoPizzaSizeId solo acepta tamaños, no presentaciones', async () => {
      const bad = await api<ErrorBody>(`/menu-items/${simple}`, {
        token: owner.token,
        method: 'PATCH',
        body: { promoPizzaCount: 1, promoPizzaSizeId: portion.docena },
      });
      expect(bad.status).toBe(400);
      const good = await api(`/menu-items/${simple}`, {
        token: owner.token,
        method: 'PATCH',
        body: { promoPizzaCount: 1, promoPizzaSizeId: menu.sizeGrande },
      });
      expect(good.status).toBe(200);
      await api(`/menu-items/${simple}`, {
        token: owner.token,
        method: 'PATCH',
        body: { promoPizzaCount: null, promoPizzaSizeId: null },
      });
    });

    it('un ítem de pizzas no admite overrides de presentaciones (400)', async () => {
      const res = await api<ErrorBody>(`/menu-items/${menu.pizza}/prices`, {
        token: owner.token,
        method: 'PUT',
        body: { priceOverrides: [{ sizeId: portion.docena, price: 9 }] },
      });
      expect(res.status).toBe(400);
    });
  });

  describe('escritura de ítems con presentaciones', () => {
    it('POST guarda los overrides de presentaciones junto al price base', async () => {
      const res = await createEntrada('tequenos-b', { priceOverrides: overridesFor(['media_docena', 'docena']) });
      expect(res.status).toBe(201);
      const { results } = await env.DB.prepare('SELECT size_id, price FROM item_prices WHERE item_id = ? ORDER BY price').bind(res.body.id).all();
      expect(results).toEqual([
        { size_id: portion.media_docena, price: 20 },
        { size_id: portion.docena, price: 36 },
      ]);
    });

    it('POST con un tamaño de pizza como override en categoría sin tamaños se rechaza y no crea el ítem', async () => {
      const res = await createEntrada('mal-tamano', { priceOverrides: [{ sizeId: menu.sizeGrande, price: 9 }] });
      expect(res.status).toBe(400);
      const row = await env.DB.prepare("SELECT id FROM menu_items WHERE slug = 'mal-tamano'").first();
      expect(row).toBeNull();
    });

    it('POST con una presentación inexistente da 400', async () => {
      const res = await createEntrada('no-existe', { priceOverrides: [{ sizeId: 99_999, price: 9 }] });
      expect(res.status).toBe(400);
    });

    it('POST sin price en categoría sin tamaños sigue exigiéndolo', async () => {
      const res = await createEntrada('sin-precio', { price: null, priceOverrides: overridesFor(['docena']) });
      expect(res.status).toBe(400);
    });

    it('PATCH con priceOverrides reemplaza el set; [] las quita; sin el campo las conserva', async () => {
      const created = await createEntrada('tequenos-c', { priceOverrides: overridesFor() });
      const id = created.body.id;
      const count = async () =>
        (await env.DB.prepare('SELECT COUNT(*) AS n FROM item_prices WHERE item_id = ?').bind(id).first<{ n: number }>())!.n;

      const replace = await api(`/menu-items/${id}`, {
        token: owner.token,
        method: 'PATCH',
        body: { priceOverrides: overridesFor(['dos_docenas']) },
      });
      expect(replace.status).toBe(200);
      expect(await count()).toBe(1);

      await api(`/menu-items/${id}`, { token: owner.token, method: 'PATCH', body: { nameEs: 'Tequeños C' } });
      expect(await count()).toBe(1);

      const clear = await api(`/menu-items/${id}`, { token: owner.token, method: 'PATCH', body: { priceOverrides: [] } });
      expect(clear.status).toBe(200);
      expect(await count()).toBe(0);
    });

    it('PATCH con overrides de tamaño en categoría sin tamaños da 400 y no toca lo existente', async () => {
      const res = await api(`/menu-items/${tequenos}`, {
        token: owner.token,
        method: 'PATCH',
        body: { priceOverrides: [{ sizeId: menu.sizeMediana, price: 5 }] },
      });
      expect(res.status).toBe(400);
      const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM item_prices WHERE item_id = ?').bind(tequenos).first<{ n: number }>();
      expect(n!.n).toBe(4);
    });

    it('mover el ítem a una categoría con tamaños descarta sus presentaciones', async () => {
      const created = await createEntrada('tequenos-d', { priceOverrides: overridesFor() });
      const sized = await env.DB.prepare('SELECT id FROM categories WHERE has_sizes = 1 LIMIT 1').first<{ id: number }>();
      const res = await api(`/menu-items/${created.body.id}`, {
        token: owner.token,
        method: 'PATCH',
        body: { categoryId: sized!.id, price: null },
      });
      expect(res.status).toBe(200);
      const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM item_prices WHERE item_id = ?').bind(created.body.id).first<{ n: number }>();
      expect(n!.n).toBe(0);
    });

    it('PUT /:id/prices funciona para ítems sin tamaños (presentaciones) y valida el tipo', async () => {
      const created = await createEntrada('tequenos-e');
      const ok = await api<Array<{ sizeId: number; price: number }>>(`/menu-items/${created.body.id}/prices`, {
        token: owner.token,
        method: 'PUT',
        body: { priceOverrides: overridesFor(['media_docena', 'docena']) },
      });
      expect(ok.status).toBe(200);
      expect(ok.body).toHaveLength(2);
      const bad = await api(`/menu-items/${created.body.id}/prices`, {
        token: owner.token,
        method: 'PUT',
        body: { priceOverrides: [{ sizeId: menu.sizeGrande, price: 5 }] },
      });
      expect(bad.status).toBe(400);
    });

    it('admin puede; el cajero recibe 403 al crear, editar y fijar precios', async () => {
      const asAdmin = await api(`/menu-items/${tequenos}/prices`, {
        token: admin.token,
        method: 'PUT',
        body: { priceOverrides: overridesFor() },
      });
      expect(asAdmin.status).toBe(200);
      const post = await api('/menu-items', {
        token: cashier.token,
        method: 'POST',
        body: { categoryId: entradasId, nameEs: 'X', price: 1, priceOverrides: overridesFor(['docena']) },
      });
      const patch = await api(`/menu-items/${tequenos}`, {
        token: cashier.token,
        method: 'PATCH',
        body: { priceOverrides: overridesFor(['docena']) },
      });
      const put = await api(`/menu-items/${tequenos}/prices`, {
        token: cashier.token,
        method: 'PUT',
        body: { priceOverrides: overridesFor(['docena']) },
      });
      expect([post.status, patch.status, put.status]).toEqual([403, 403, 403]);
    });
  });

  describe('lectura pública de presentaciones', () => {
    it('/menu-items/sections devuelve prices con presentaciones; sin presentaciones queda []', async () => {
      const res = await api<SectionBody>('/menu-items/sections');
      expect(res.status).toBe(200);
      const entradas = res.body.find((s) => s.category.slug === 'entradas')!;
      const teq = entradas.items.find((i) => i.id === tequenos)!;
      expect(teq.price).toBe(36);
      expect(teq.prices.map((p) => [p.sizeKey, p.price, p.units, p.kind])).toEqual([
        ['media_docena', 20, 6, 'portion'],
        ['docena', 36, 12, 'portion'],
        ['docena_y_media', 52, 18, 'portion'],
        ['dos_docenas', 70, 24, 'portion'],
      ]);
      expect(teq.prices[0]).toMatchObject({ sizeId: portion.media_docena, labelEs: 'Media docena', isOverride: true });
      expect(entradas.items.find((i) => i.id === simple)!.prices).toEqual([]);
    });

    it('las categorías con tamaños no incluyen presentaciones en sus precios', async () => {
      const res = await api<SectionBody>('/menu-items/sections');
      const pizzas = res.body.find((s) => s.category.slug === 'pizzas')!;
      const pizza = pizzas.items.find((i) => i.id === menu.pizza)!;
      expect(pizza.prices.map((p) => p.sizeId)).toEqual([menu.sizeMediana, menu.sizeGrande]);
    });

    it('el detalle por slug trae las presentaciones y el detalle por ítem simple trae []', async () => {
      const detail = await api<MenuItemDetail>('/menu-items/tequenos');
      expect(detail.status).toBe(200);
      expect(detail.body.prices.map((p) => p.sizeKey)).toEqual(['media_docena', 'docena', 'docena_y_media', 'dos_docenas']);
      const plain = await api<MenuItemDetail>('/menu-items/yuca-frita');
      expect(plain.body.prices).toEqual([]);
    });

    it('un ítem solo-POS con presentaciones no aparece en la carta web pero sí con channel=pos', async () => {
      const posOnly = await createEntrada('tequenos-pos', { channel: 'pos', priceOverrides: overridesFor(['docena']) });
      const web = await api<SectionBody>('/menu-items/sections');
      const webIds = web.body.flatMap((s) => s.items.map((i) => i.id));
      expect(webIds).not.toContain(posOnly.body.id);
      const pos = await api<SectionBody>('/menu-items/sections?channel=pos', { token: cashier.token });
      const found = pos.body.flatMap((s) => s.items).find((i) => i.id === posOnly.body.id);
      expect(found?.prices).toHaveLength(1);
    });
  });

  describe('pedido web con presentación', () => {
    it('tasa el precio de la presentación y guarda size_label como snapshot', async () => {
      const token = await createCustomer();
      const res = await customerOrder(token, [{ itemId: tequenos, sizeId: portion.docena_y_media, quantity: 2 }]);
      expect(res.status).toBe(201);
      expect(res.body.subtotal).toBe(104);
      expect(res.body.items[0]).toMatchObject({ unitPrice: 52, sizeLabel: 'Docena y media', quantity: 2 });
    });

    it('sin sizeId se rechaza con mensaje claro', async () => {
      const token = await createCustomer();
      const res = await customerOrder(token, [{ itemId: tequenos, quantity: 1 }]);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/presentaci/i);
    });

    it('una presentación que el ítem no tiene, un tamaño de pizza o un id inexistente dan 400', async () => {
      const token = await createCustomer();
      const partial = await createEntrada('tequenos-parcial', { priceOverrides: overridesFor(['docena']) });
      const notOwned = await customerOrder(token, [{ itemId: partial.body.id, sizeId: portion.dos_docenas, quantity: 1 }]);
      const pizzaSize = await customerOrder(token, [{ itemId: tequenos, sizeId: menu.sizeGrande, quantity: 1 }]);
      const missing = await customerOrder(token, [{ itemId: tequenos, sizeId: 99_999, quantity: 1 }]);
      expect([notOwned.status, pizzaSize.status, missing.status]).toEqual([400, 400, 400]);
      expect(notOwned.body.error).toMatch(/presentaci/i);
    });

    it('un ítem sin presentaciones sigue rechazando sizeId', async () => {
      const token = await createCustomer();
      const withSize = await customerOrder(token, [{ itemId: simple, sizeId: portion.docena, quantity: 1 }]);
      expect(withSize.status).toBe(400);
      const plain = await customerOrder(token, [{ itemId: simple, quantity: 2 }]);
      expect(plain.status).toBe(201);
      expect(plain.body.items[0]).toMatchObject({ unitPrice: 15, sizeLabel: null });
    });

    it('una pizza no acepta una presentación como sizeId', async () => {
      const token = await createCustomer();
      const res = await customerOrder(token, [{ itemId: menu.pizza, sizeId: portion.docena, quantity: 1 }]);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/presentaci/i);
    });

    it('el precio del cliente se ignora: no puede forzar el precio de una presentación', async () => {
      const token = await createCustomer();
      const res = await customerOrder(token, [{ itemId: tequenos, sizeId: portion.media_docena, quantity: 1, price: 1, unitPrice: 1 }]);
      expect(res.status === 201 || res.status === 400).toBe(true);
      if (res.status === 201) expect(res.body.items[0]?.unitPrice).toBe(20);
    });

    it('la edición del pedido (PUT /orders/:id/items) re-tasa con presentaciones', async () => {
      const token = await createCustomer();
      const order = await customerOrder(token, [{ itemId: menu.gaseosa, quantity: 1 }]);
      const edited = await api<OrderDto & ErrorBody>(`/orders/${order.body.id}/items`, {
        token: owner.token,
        method: 'PUT',
        body: {
          items: [
            { itemId: tequenos, sizeId: portion.media_docena, quantity: 1 },
            { itemId: tequenos, sizeId: portion.dos_docenas, quantity: 1 },
          ],
        },
      });
      expect(edited.status).toBe(200);
      expect(edited.body.subtotal).toBe(90);
      expect(edited.body.items.map((i) => i.sizeLabel)).toEqual(['Media docena', '2 docenas']);

      const bad = await api<ErrorBody>(`/orders/${order.body.id}/items`, {
        token: owner.token,
        method: 'PUT',
        body: { items: [{ itemId: tequenos, quantity: 1 }] },
      });
      expect(bad.status).toBe(400);
    });

    it('"Cobrar pedido web" toma el snapshot de la presentación', async () => {
      const token = await createCustomer();
      const order = await customerOrder(token, [{ itemId: tequenos, sizeId: portion.docena, quantity: 3 }]);
      const confirm = await api(`/orders/${order.body.id}`, { token: owner.token, method: 'PATCH', body: { status: 'confirmed' } });
      expect(confirm.status).toBe(200);
      await openCash(cashier.token);
      const sale = await api<Sale & ErrorBody>('/sales', {
        token: cashier.token,
        method: 'POST',
        body: { clientUuid: crypto.randomUUID(), orderId: order.body.id, paymentMethod: 'yape' },
      });
      expect(sale.status).toBe(201);
      expect(sale.body.totalCents).toBe(10_800);
      expect(sale.body.items[0]).toMatchObject({ name: 'Tequeños', sizeLabel: '1 docena', unitPriceCents: 3_600, quantity: 3 });
    });
  });

  describe('POS y Mesas con presentación', () => {
    beforeEach(async () => {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM dining_tab_items'),
        env.DB.prepare('DELETE FROM dining_tabs'),
        env.DB.prepare('DELETE FROM sale_items'),
        env.DB.prepare('DELETE FROM sales'),
        env.DB.prepare('DELETE FROM cash_sessions'),
      ]);
    });

    const postSale = (items: unknown[]) =>
      api<Sale & ErrorBody>('/sales', {
        token: cashier.token,
        method: 'POST',
        body: { clientUuid: crypto.randomUUID(), paymentMethod: 'efectivo', cashReceivedCents: 20_000, items },
      });

    it('venta de mostrador: precio, size_id y size_label de la presentación', async () => {
      await openCash(cashier.token);
      const res = await postSale([{ itemId: tequenos, sizeId: portion.dos_docenas, quantity: 1 }]);
      expect(res.status).toBe(201);
      expect(res.body.totalCents).toBe(7_000);
      expect(res.body.items[0]).toMatchObject({ sizeId: portion.dos_docenas, sizeLabel: '2 docenas', unitPriceCents: 7_000 });
    });

    it('venta sin presentación para un ítem que las tiene da 400; ítem simple sigue igual', async () => {
      await openCash(cashier.token);
      const missing = await postSale([{ itemId: tequenos, quantity: 1 }]);
      expect(missing.status).toBe(400);
      expect(missing.body.error).toMatch(/presentaci/i);
      const plain = await postSale([{ itemId: simple, quantity: 2 }]);
      expect(plain.status).toBe(201);
      expect(plain.body.totalCents).toBe(3_000);
    });

    it('Mesas: la misma comida en dos presentaciones son líneas distintas y se cobran bien', async () => {
      await openCash(cashier.token);
      const mesa = (await env.DB.prepare("SELECT id FROM dining_tables WHERE label = '1'").first<{ id: number }>())!.id;
      const tab = await api<DiningTab & ErrorBody>(`/tables/${mesa}/tab`, {
        token: cashier.token,
        method: 'PUT',
        body: {
          expectedVersion: null,
          items: [
            { itemId: tequenos, sizeId: portion.media_docena, quantity: 1 },
            { itemId: tequenos, sizeId: portion.docena, quantity: 2 },
          ],
        },
      });
      expect(tab.status).toBe(201);
      expect(tab.body.items.map((i) => [i.sizeLabel, i.unitPriceCents, i.quantity])).toEqual([
        ['Media docena', 2_000, 1],
        ['1 docena', 3_600, 2],
      ]);

      const again = await api<DiningTab & ErrorBody>(`/tables/${mesa}/tab`, {
        token: cashier.token,
        method: 'PUT',
        body: {
          expectedVersion: tab.body.version,
          items: [
            { itemId: tequenos, sizeId: portion.media_docena, quantity: 1 },
            { itemId: tequenos, sizeId: portion.docena, quantity: 3 },
          ],
        },
      });
      expect(again.status).toBe(200);
      expect(again.body.items.find((i) => i.sizeLabel === '1 docena')?.quantity).toBe(3);

      const paid = await api<Sale & ErrorBody>(`/tables/${mesa}/tab/close`, {
        token: cashier.token,
        method: 'POST',
        body: { tabId: tab.body.id, expectedVersion: again.body.version },
      });
      expect(paid.status).toBe(201);
      expect(paid.body.totalCents).toBe(2_000 + 3 * 3_600);
      expect(paid.body.items.map((i) => i.sizeLabel).sort()).toEqual(['1 docena', 'Media docena']);
    });

    it('Mesas: sin presentación para un ítem que las tiene da 400', async () => {
      const mesa = (await env.DB.prepare("SELECT id FROM dining_tables WHERE label = '2'").first<{ id: number }>())!.id;
      const res = await api<ErrorBody>(`/tables/${mesa}/tab`, {
        token: cashier.token,
        method: 'PUT',
        body: { expectedVersion: null, items: [{ itemId: tequenos, quantity: 1 }] },
      });
      expect(res.status).toBe(400);
    });
  });
});
