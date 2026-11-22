import { env, exports } from 'cloudflare:workers';
import { hashPassword } from '../src/lib/password';
import { signToken } from '../src/lib/jwt';

const app = exports.default;
const BASE = 'https://example.com/api';

export type StaffRole = 'owner' | 'admin' | 'cashier';

export interface TestUser {
  id: number;
  token: string;
}

/** Crea un usuario directo en D1 (sin pasar por la API) y devuelve su id + un token válido. */
export async function createUser(email: string, role: StaffRole): Promise<TestUser> {
  const passwordHash = await hashPassword('correcthorsebattery');
  const row = await env.DB.prepare(
    'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?) RETURNING id, token_version',
  )
    .bind(email, passwordHash, 'Test User', role)
    .first<{ id: number; token_version: number }>();
  const token = await signToken({ id: row!.id, email, role }, env.JWT_SECRET, row!.token_version);
  return { id: row!.id, token };
}

/** Llama a la API como `token` (o anónimo) y devuelve status + body JSON ya parseado. */
export async function api<T = unknown>(
  path: string,
  options: { token?: string; method?: string; body?: unknown } = {},
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const res = await app.fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: res.status, body: (await res.json()) as T };
}

export interface MenuFixture {
  sizeMediana: number;
  sizeGrande: number;
  pizza: number; // both, con tamaños (20.00 / 30.00)
  pizzaWebOnly: number;
  pizzaPosOnly: number;
  pizzaInactive: number;
  gaseosa: number; // both, sin tamaños, 5.50
  gaseosaPosOnly: number; // pos, sin tamaños, 3.00
}

async function insertItem(
  categoryId: number,
  slug: string,
  price: number | null,
  channel: 'both' | 'web' | 'pos',
  isActive = 1,
): Promise<number> {
  const row = await env.DB.prepare(
    `INSERT INTO menu_items (category_id, slug, name_es, price, channel, is_active)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(categoryId, slug, `Item ${slug}`, price, channel, isActive)
    .first<{ id: number }>();
  return row!.id;
}

/** Menú mínimo con precios conocidos: pizzas por tamaño (20/30) y bebidas sin tamaño. */
export async function seedMenu(): Promise<MenuFixture> {
  const mediana = await env.DB.prepare(
    "INSERT INTO sizes (key, label_es, label_en, display_order) VALUES ('mediana', 'Mediana', 'Medium', 1) RETURNING id",
  ).first<{ id: number }>();
  const grande = await env.DB.prepare(
    "INSERT INTO sizes (key, label_es, label_en, display_order) VALUES ('grande', 'Grande', 'Large', 2) RETURNING id",
  ).first<{ id: number }>();
  const pizzas = await env.DB.prepare(
    "INSERT INTO categories (slug, name_es, has_sizes) VALUES ('pizzas', 'Pizzas', 1) RETURNING id",
  ).first<{ id: number }>();
  const bebidas = await env.DB.prepare(
    "INSERT INTO categories (slug, name_es, has_sizes) VALUES ('bebidas', 'Bebidas', 0) RETURNING id",
  ).first<{ id: number }>();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO category_prices (category_id, size_id, price) VALUES (?, ?, 20)').bind(
      pizzas!.id,
      mediana!.id,
    ),
    env.DB.prepare('INSERT INTO category_prices (category_id, size_id, price) VALUES (?, ?, 30)').bind(
      pizzas!.id,
      grande!.id,
    ),
  ]);
  return {
    sizeMediana: mediana!.id,
    sizeGrande: grande!.id,
    pizza: await insertItem(pizzas!.id, 'pizza', null, 'both'),
    pizzaWebOnly: await insertItem(pizzas!.id, 'pizza-web', null, 'web'),
    pizzaPosOnly: await insertItem(pizzas!.id, 'pizza-pos', null, 'pos'),
    pizzaInactive: await insertItem(pizzas!.id, 'pizza-off', null, 'both', 0),
    gaseosa: await insertItem(bebidas!.id, 'gaseosa', 5.5, 'both'),
    gaseosaPosOnly: await insertItem(bebidas!.id, 'gaseosa-pos', 3, 'pos'),
  };
}

/** Deja la caja y las ventas en blanco entre tests (el storage se comparte dentro del archivo). */
export async function resetPos(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sale_items'),
    env.DB.prepare('DELETE FROM sales'),
    env.DB.prepare('DELETE FROM expenses'),
    env.DB.prepare('DELETE FROM cash_sessions'),
  ]);
}

export async function openCash(token: string, openingCashCents = 10_000): Promise<number> {
  const res = await api<{ id: number }>('/cash-sessions', {
    token,
    method: 'POST',
    body: { openingCashCents },
  });
  if (res.status !== 201) throw new Error(`no se pudo abrir caja: ${res.status}`);
  return res.body.id;
}

/** Pedido web `confirmed` (storefront) con una línea de `quantity` × `unitPrice` soles. */
export async function createConfirmedOrder(
  itemId: number,
  unitPrice: number,
  quantity: number,
  status: 'pending' | 'confirmed' = 'confirmed',
): Promise<number> {
  const email = `cliente-${crypto.randomUUID()}@test.local`;
  const customer = await env.DB.prepare(
    "INSERT INTO customers (email, phone, password_hash, name) VALUES (?, '999111222', 'x', 'Cliente Web') RETURNING id",
  )
    .bind(email)
    .first<{ id: number }>();
  const order = await env.DB.prepare(
    "INSERT INTO orders (customer_id, code, status, subtotal, confirmed_at) VALUES (?, ?, ?, ?, CASE WHEN ?5 = 'confirmed' THEN datetime('now') END) RETURNING id",
  )
    .bind(customer!.id, crypto.randomUUID().slice(0, 8), status, unitPrice * quantity, status)
    .first<{ id: number }>();
  await env.DB.prepare(
    `INSERT INTO order_items (order_id, item_id, name_es, size_label, unit_price, quantity)
     VALUES (?, ?, 'Pizza web', 'Grande', ?, ?)`,
  )
    .bind(order!.id, itemId, unitPrice, quantity)
    .run();
  return order!.id;
}
