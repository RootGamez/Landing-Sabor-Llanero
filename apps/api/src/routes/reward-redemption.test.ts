import { env, exports } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { signCustomerToken, signToken } from '../lib/jwt';
import type { OrderRow, RewardRedemptionRow } from '../db/rows';

const app = exports.default;
const jsonHeaders = { 'Content-Type': 'application/json' };

async function createCustomer(email: string, pointsBalance: number): Promise<{ id: number; token: string }> {
  const row = await env.DB.prepare(
    'INSERT INTO customers (email, phone, password_hash, name, points_balance) VALUES (?, ?, ?, ?, ?) RETURNING id',
  )
    .bind(email, '999999999', 'not-a-real-hash', 'Cliente de Prueba', pointsBalance)
    .first<{ id: number }>();
  const token = await signCustomerToken({ customerId: row!.id, email }, env.CUSTOMER_JWT_SECRET, 0);
  return { id: row!.id, token };
}

async function createStaff(email: string): Promise<{ id: number; token: string }> {
  const row = await env.DB.prepare(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?, 'not-a-real-hash', 'Staff de Prueba', 'admin') RETURNING id",
  )
    .bind(email)
    .first<{ id: number }>();
  const token = await signToken({ id: row!.id, email, name: 'Staff de Prueba', role: 'admin' }, env.JWT_SECRET, 0);
  return { id: row!.id, token };
}

async function createReward(input: { pointsCost: number; price: number; discountPrice?: number; isActive?: boolean }): Promise<number> {
  const row = await env.DB.prepare(
    `INSERT INTO rewards (name_es, name_en, points_cost, price, discount_price, is_active)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(
      'Premio de Prueba',
      'Test Reward',
      input.pointsCost,
      input.price,
      input.discountPrice ?? null,
      input.isActive ?? true ? 1 : 0,
    )
    .first<{ id: number }>();
  return row!.id;
}

async function pointsBalanceOf(customerId: number): Promise<number> {
  const row = await env.DB.prepare('SELECT points_balance FROM customers WHERE id = ?')
    .bind(customerId)
    .first<{ points_balance: number }>();
  return row!.points_balance;
}

describe('POST /api/rewards/:id/redeem', () => {
  it('rechaza el canje con saldo insuficiente (409) sin tocar el balance', async () => {
    const customer = await createCustomer('redeem-insufficient@test.local', 10);
    const rewardId = await createReward({ pointsCost: 500, price: 25 });

    const res = await app.fetch(`https://example.com/api/rewards/${rewardId}/redeem`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer.token}` },
    });

    expect(res.status).toBe(409);
    expect(await pointsBalanceOf(customer.id)).toBe(10);
  });

  it('rechaza el canje de un premio sin precio configurado (400)', async () => {
    const customer = await createCustomer('redeem-nopricel@test.local', 500);
    const rewardId = await env.DB.prepare(
      "INSERT INTO rewards (name_es, name_en, points_cost, is_active) VALUES ('Sin precio', '', 100, 1) RETURNING id",
    )
      .first<{ id: number }>()
      .then((r) => r!.id);

    const res = await app.fetch(`https://example.com/api/rewards/${rewardId}/redeem`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer.token}` },
    });

    expect(res.status).toBe(400);
    expect(await pointsBalanceOf(customer.id)).toBe(500);
  });

  it('canjea con éxito: descuenta puntos, crea un pedido pendiente igual al premio y enlaza la redención', async () => {
    const customer = await createCustomer('redeem-success@test.local', 500);
    const rewardId = await createReward({ pointsCost: 300, price: 25, discountPrice: 18 });

    const res = await app.fetch(`https://example.com/api/rewards/${rewardId}/redeem`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer.token}` },
    });

    expect(res.status).toBe(201);
    const body = await res.json() as {
      pointsBalance: number;
      order: { code: string; status: string; subtotal: number; source: string; items: Array<{ rewardId: number; itemId: number | null; unitPrice: number; quantity: number }> };
      redemption: { orderId: number; pointsSpent: number; status: string };
    };

    expect(body.pointsBalance).toBe(200);
    expect(await pointsBalanceOf(customer.id)).toBe(200);

    expect(body.order.status).toBe('pending');
    expect(body.order.source).toBe('reward_redemption');
    // El pedido documenta el precio CON descuento del premio (18), no el de referencia (25).
    expect(body.order.subtotal).toBe(18);
    expect(body.order.items).toHaveLength(1);
    expect(body.order.items[0]!.rewardId).toBe(rewardId);
    expect(body.order.items[0]!.itemId).toBeNull();
    expect(body.order.items[0]!.unitPrice).toBe(18);
    expect(body.order.items[0]!.quantity).toBe(1);

    expect(body.redemption.orderId).not.toBeNull();
    expect(body.redemption.pointsSpent).toBe(300);
    expect(body.redemption.status).toBe('pending');

    const ledgerRow = await env.DB.prepare(
      "SELECT * FROM points_ledger WHERE customer_id = ? AND reason = 'reward_redeemed'",
    )
      .bind(customer.id)
      .first<{ order_id: number; delta: number }>();
    expect(ledgerRow?.order_id).toBe(body.redemption.orderId);
    expect(ledgerRow?.delta).toBe(-300);
  });
});

describe('PATCH /api/orders/:id — pedidos generados por un canje de premio', () => {
  async function redeemReward(pointsBalance: number, pointsCost: number): Promise<{
    customer: { id: number; token: string };
    orderId: number;
    redemptionId: number;
  }> {
    const customer = await createCustomer(`redeem-flow-${crypto.randomUUID()}@test.local`, pointsBalance);
    const rewardId = await createReward({ pointsCost, price: 20 });
    const res = await app.fetch(`https://example.com/api/rewards/${rewardId}/redeem`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customer.token}` },
    });
    const body = await res.json() as { order: { id: number }; redemption: { id: number } };
    return { customer, orderId: body.order.id, redemptionId: body.redemption.id };
  }

  it('al confirmar: NO acredita puntos ni entrada al sorteo, y la redención pasa a fulfilled', async () => {
    const { customer, orderId, redemptionId } = await redeemReward(500, 300);
    const staff = await createStaff(`staff-confirm-${crypto.randomUUID()}@test.local`);

    const res = await app.fetch(`https://example.com/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, Authorization: `Bearer ${staff.token}` },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    expect(res.status).toBe(200);
    const order = (await res.json()) as OrderRow & { pointsAwarded: number | null };
    expect(order.pointsAwarded).toBeNull();

    // El canje ya dejó el balance en 200 (500 - 300); confirmar NO debe sumarle nada encima.
    expect(await pointsBalanceOf(customer.id)).toBe(200);

    const redemption = await env.DB.prepare('SELECT * FROM reward_redemptions WHERE id = ?')
      .bind(redemptionId)
      .first<RewardRedemptionRow>();
    expect(redemption?.status).toBe('fulfilled');
    expect(redemption?.fulfilled_at).not.toBeNull();

    const raffleEntry = await env.DB.prepare('SELECT * FROM raffle_entries WHERE order_id = ?')
      .bind(orderId)
      .first();
    expect(raffleEntry).toBeNull();
  });

  it('al cancelar: reembolsa los puntos gastados y la redención pasa a cancelled', async () => {
    const { customer, orderId, redemptionId } = await redeemReward(500, 300);
    const staff = await createStaff(`staff-cancel-${crypto.randomUUID()}@test.local`);

    expect(await pointsBalanceOf(customer.id)).toBe(200);

    const res = await app.fetch(`https://example.com/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, Authorization: `Bearer ${staff.token}` },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    expect(res.status).toBe(200);

    // 200 + 300 reembolsados = 500, el balance original antes del canje.
    expect(await pointsBalanceOf(customer.id)).toBe(500);

    const redemption = await env.DB.prepare('SELECT * FROM reward_redemptions WHERE id = ?')
      .bind(redemptionId)
      .first<RewardRedemptionRow>();
    expect(redemption?.status).toBe('cancelled');

    const refundLedgerRow = await env.DB.prepare(
      "SELECT * FROM points_ledger WHERE customer_id = ? AND reason = 'reward_redemption_refunded'",
    )
      .bind(customer.id)
      .first<{ order_id: number; delta: number }>();
    expect(refundLedgerRow?.order_id).toBe(orderId);
    expect(refundLedgerRow?.delta).toBe(300);
  });
});

describe('PATCH /api/orders/:id — regresión: pedidos normales de storefront', () => {
  beforeAll(async () => {
    await env.DB.prepare(
      'INSERT INTO loyalty_config (points_per_currency_unit, min_order_amount_for_points) SELECT 1, 0 WHERE NOT EXISTS (SELECT 1 FROM loyalty_config)',
    ).run();
  });

  it('al confirmar un pedido normal (source=storefront) SÍ acredita puntos y entrada al sorteo, como antes', async () => {
    const customer = await createCustomer('storefront-regression@test.local', 0);
    const staff = await createStaff('staff-storefront-regression@test.local');

    const category = await env.DB.prepare(
      "INSERT INTO categories (slug, name_es, name_en, has_sizes) VALUES ('cat-test-regresion', 'Cat Test', 'Cat Test', 0) RETURNING id",
    ).first<{ id: number }>();
    const item = await env.DB.prepare(
      'INSERT INTO menu_items (category_id, slug, name_es, name_en, price) VALUES (?, ?, ?, ?, ?) RETURNING id',
    )
      .bind(category!.id, 'item-test-regresion', 'Item Test', 'Item Test', 40)
      .first<{ id: number }>();

    const createRes = await app.fetch('https://example.com/api/orders', {
      method: 'POST',
      headers: { ...jsonHeaders, Authorization: `Bearer ${customer.token}` },
      body: JSON.stringify({ items: [{ itemId: item!.id, quantity: 1 }] }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: number; source: string };
    expect(created.source).toBe('storefront');

    const confirmRes = await app.fetch(`https://example.com/api/orders/${created.id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, Authorization: `Bearer ${staff.token}` },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    expect(confirmRes.status).toBe(200);
    const confirmed = (await confirmRes.json()) as { pointsAwarded: number };
    expect(confirmed.pointsAwarded).toBe(40);
    expect(await pointsBalanceOf(customer.id)).toBe(40);

    const raffleEntry = await env.DB.prepare('SELECT * FROM raffle_entries WHERE order_id = ?')
      .bind(created.id)
      .first();
    expect(raffleEntry).not.toBeNull();
  });
});
