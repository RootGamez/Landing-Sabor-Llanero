import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Migración 0009 (back-office, Plan Parte 3 · F2). El harness ya aplicó TODAS
 * las migraciones antes de este archivo (test/apply-migrations.ts), así que
 * acá se verifica el esquema resultante: seeds, CHECKs, índices únicos y, lo
 * más delicado, que el rebuild de `users` (para sumar el rol `cashier`) NO
 * pierda ni desconecte filas hijas (FK con CASCADE / SET NULL / RESTRICT).
 */

const db = env.DB;

interface Migration {
  name: string;
  queries: string[];
}

async function run(sql: string, ...params: unknown[]): Promise<void> {
  await db
    .prepare(sql)
    .bind(...params)
    .run();
}

async function expectRejected(sql: string, ...params: unknown[]): Promise<void> {
  await expect(run(sql, ...params)).rejects.toThrow();
}

async function count(sql: string, ...params: unknown[]): Promise<number> {
  const row = await db
    .prepare(sql)
    .bind(...params)
    .first<{ n: number }>();
  return row!.n;
}

async function insertUser(email: string, role: string): Promise<number> {
  const row = await db
    .prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?) RETURNING id')
    .bind(email, 'hash', 'Test', role)
    .first<{ id: number }>();
  return row!.id;
}

async function openSession(openedBy: number | null, legacyRef: string | null = null): Promise<number> {
  const row = await db
    .prepare(
      'INSERT INTO cash_sessions (opened_by, opening_cash_cents, legacy_ref) VALUES (?, 0, ?) RETURNING id',
    )
    .bind(openedBy, legacyRef)
    .first<{ id: number }>();
  return row!.id;
}

async function insertSale(sessionId: number, number: number, extra: Record<string, unknown> = {}): Promise<number> {
  const cols = {
    session_id: sessionId,
    number,
    subtotal_cents: 2500,
    total_cents: 2500,
    payment_method: 'efectivo',
    ...extra,
  };
  const names = Object.keys(cols);
  const row = await db
    .prepare(`INSERT INTO sales (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')}) RETURNING id`)
    .bind(...Object.values(cols))
    .first<{ id: number }>();
  return row!.id;
}

describe('0009 · rol cashier en users', () => {
  it('acepta owner, admin y cashier y sigue rechazando roles desconocidos', async () => {
    await insertUser('r-owner@test.local', 'owner');
    await insertUser('r-admin@test.local', 'admin');
    await insertUser('r-cashier@test.local', 'cashier');
    await expectRejected(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      'r-bad@test.local',
      'hash',
      'Test',
      'superadmin',
    );
  });

  it('mantiene UNIQUE(email) en users', async () => {
    await insertUser('dup@test.local', 'admin');
    await expectRejected(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      'dup@test.local',
      'hash',
      'Test',
      'admin',
    );
  });
});

describe('0009 · rebuild de users conserva las tablas hijas', () => {
  let userId: number;
  let customerId: number;

  beforeAll(async () => {
    userId = await insertUser('rebuild-parent@test.local', 'owner');
    customerId = (
      await db
        .prepare(
          "INSERT INTO customers (email, phone, password_hash, name) VALUES ('rb-cust@test.local', '999', 'h', 'Cli') RETURNING id",
        )
        .first<{ id: number }>()
    )!.id;
    const orderId = (
      await db
        .prepare(
          "INSERT INTO orders (customer_id, code, subtotal, confirmed_by) VALUES (?, 'RB0001', 10, ?) RETURNING id",
        )
        .bind(customerId, userId)
        .first<{ id: number }>()
    )!.id;
    await run(
      "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, 'tok-rebuild', '2999-01-01')",
      userId,
    );
    const rewardId = (
      await db
        .prepare("INSERT INTO rewards (name_es, points_cost) VALUES ('Premio rebuild', 10) RETURNING id")
        .first<{ id: number }>()
    )!.id;
    await run(
      "INSERT INTO reward_redemptions (customer_id, reward_id, points_spent, status, fulfilled_by) VALUES (?, ?, 10, 'fulfilled', ?)",
      customerId,
      rewardId,
      userId,
    );
    const entryId = (
      await db
        .prepare(
          "INSERT INTO raffle_entries (customer_id, order_id, period) VALUES (?, ?, '2026-01') RETURNING id",
        )
        .bind(customerId, orderId)
        .first<{ id: number }>()
    )!.id;
    await run(
      "INSERT INTO raffle_draws (period, winner_customer_id, winner_entry_id, drawn_by) VALUES ('2026-01', ?, ?, ?)",
      customerId,
      entryId,
      userId,
    );
  });

  it('re-ejecutar el bloque de rebuild de 0009 no borra, anula ni desconecta filas hijas', async () => {
    const migrations = env.TEST_MIGRATIONS as unknown as Migration[];
    const migration = migrations.find((m) => m.name.startsWith('0009_'));
    expect(migration).toBeDefined();
    // El rebuild de users va primero en el archivo, antes de tocar menu_items.
    const firstOtherIdx = migration!.queries.findIndex((q) => q.includes('menu_items'));
    const rebuild = migration!.queries.slice(0, firstOtherIdx);
    expect(rebuild.some((q) => q.includes('CREATE TABLE users'))).toBe(true);

    await db.batch(rebuild.map((q) => db.prepare(q)));

    expect(await count('SELECT COUNT(*) AS n FROM users WHERE id = ?', userId)).toBe(1);
    expect(await count('SELECT COUNT(*) AS n FROM password_reset_tokens WHERE user_id = ?', userId)).toBe(1);
    expect(await count('SELECT COUNT(*) AS n FROM orders WHERE confirmed_by = ?', userId)).toBe(1);
    expect(await count('SELECT COUNT(*) AS n FROM reward_redemptions WHERE fulfilled_by = ?', userId)).toBe(1);
    expect(await count('SELECT COUNT(*) AS n FROM raffle_draws WHERE drawn_by = ?', userId)).toBe(1);
  });

  it('las FK de las tablas hijas siguen apuntando a `users` (no a una tabla temporal)', async () => {
    for (const table of ['orders', 'password_reset_tokens', 'reward_redemptions', 'raffle_draws']) {
      const { results } = await db.prepare(`PRAGMA foreign_key_list(${table})`).all<{ table: string }>();
      const targets = results.map((r) => r.table);
      expect(targets, table).toContain('users');
      expect(targets, table).not.toContain('users_old');
    }
    expect(await count("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'users_old'")).toBe(0);
  });

  it('no deja violaciones de integridad referencial', async () => {
    const { results } = await db.prepare('PRAGMA foreign_key_check').all();
    expect(results).toEqual([]);
  });

  it('el borrado de un usuario sigue aplicando ON DELETE SET NULL / CASCADE', async () => {
    const tempUser = await insertUser('rebuild-temp@test.local', 'admin');
    await run(
      "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, 'tok-temp', '2999-01-01')",
      tempUser,
    );
    await run(
      "INSERT INTO orders (customer_id, code, subtotal, confirmed_by) VALUES (?, 'RB0002', 10, ?)",
      customerId,
      tempUser,
    );
    await run('DELETE FROM users WHERE id = ?', tempUser);
    expect(await count('SELECT COUNT(*) AS n FROM password_reset_tokens WHERE user_id = ?', tempUser)).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM orders WHERE code = 'RB0002' AND confirmed_by IS NULL")).toBe(1);
  });
});

describe('0009 · menu_items.channel (D6)', () => {
  it('default both y solo acepta both|web|pos', async () => {
    const cat = await db
      .prepare("INSERT INTO categories (slug, name_es) VALUES ('canal-test', 'Canal') RETURNING id")
      .first<{ id: number }>();
    const item = await db
      .prepare("INSERT INTO menu_items (category_id, slug, name_es) VALUES (?, 'canal-item', 'Item') RETURNING channel")
      .bind(cat!.id)
      .first<{ channel: string }>();
    expect(item!.channel).toBe('both');
    await run("UPDATE menu_items SET channel = 'pos' WHERE slug = 'canal-item'");
    await expectRejected("UPDATE menu_items SET channel = 'otro' WHERE slug = 'canal-item'");
  });
});

describe('0009 · seeds', () => {
  it('payment_methods trae los 5 métodos del plan, todos activos y ordenados', async () => {
    const { results } = await db
      .prepare('SELECT key, is_active FROM payment_methods ORDER BY display_order')
      .all<{ key: string; is_active: number }>();
    expect(results.map((r) => r.key)).toEqual(['efectivo', 'yape', 'plin', 'tarjeta', 'transferencia']);
    expect(results.every((r) => r.is_active === 1)).toBe(true);
  });

  it('expense_categories trae las 9 categorías base como raíces', async () => {
    const { results } = await db
      .prepare('SELECT name FROM expense_categories WHERE parent_id IS NULL ORDER BY name')
      .all<{ name: string }>();
    expect(results.map((r) => r.name).sort()).toEqual(
      ['Alquiler', 'Bebidas', 'Delivery', 'Gas', 'Insumos', 'Mantenimiento', 'Otros', 'Personal', 'Servicios'].sort(),
    );
  });
});

describe('0009 · cash_sessions', () => {
  it('permite una sola sesión abierta a la vez (índice único parcial)', async () => {
    const sessionId = await openSession(null);
    await expectRejected('INSERT INTO cash_sessions (opening_cash_cents) VALUES (0)');
    await run("UPDATE cash_sessions SET closed_at = datetime('now') WHERE id = ?", sessionId);
    const next = await openSession(null);
    expect(next).toBeGreaterThan(sessionId);
    await run("UPDATE cash_sessions SET closed_at = datetime('now') WHERE id = ?", next);
  });

  it('rechaza fondo negativo y source desconocido', async () => {
    await expectRejected("INSERT INTO cash_sessions (opening_cash_cents, closed_at) VALUES (-1, datetime('now'))");
    await expectRejected(
      "INSERT INTO cash_sessions (opening_cash_cents, closed_at, source) VALUES (0, datetime('now'), 'excel')",
    );
  });

  it('legacy_ref es UNIQUE (importaciones idempotentes, D11)', async () => {
    await run("INSERT INTO cash_sessions (opening_cash_cents, closed_at, legacy_ref) VALUES (0, datetime('now'), 'aronium:z:1')");
    await expectRejected(
      "INSERT INTO cash_sessions (opening_cash_cents, closed_at, legacy_ref) VALUES (0, datetime('now'), 'aronium:z:1')",
    );
    // NULL sí se repite: las sesiones del POS no llevan legacy_ref.
    await run("INSERT INTO cash_sessions (opening_cash_cents, closed_at) VALUES (0, datetime('now'))");
    await run("INSERT INTO cash_sessions (opening_cash_cents, closed_at) VALUES (0, datetime('now'))");
  });
});

describe('0009 · sales y sale_items', () => {
  let sessionId: number;

  beforeAll(async () => {
    sessionId = await openSession(null, 'sales-suite');
    await run("UPDATE cash_sessions SET closed_at = datetime('now') WHERE id = ?", sessionId);
  });

  it('inserta una venta con defaults y rechaza montos inválidos', async () => {
    const id = await insertSale(sessionId, 1);
    const row = await db
      .prepare('SELECT discount_cents, source, voided_at FROM sales WHERE id = ?')
      .bind(id)
      .first<{ discount_cents: number; source: string; voided_at: string | null }>();
    expect(row).toEqual({ discount_cents: 0, source: 'pos', voided_at: null });

    await expectRejected(
      'INSERT INTO sales (session_id, number, subtotal_cents, total_cents, payment_method) VALUES (?, 2, -1, -1, ?)',
      sessionId,
      'efectivo',
    );
    await expectRejected(
      'INSERT INTO sales (session_id, number, subtotal_cents, discount_cents, total_cents, payment_method) VALUES (?, 3, 100, -5, 100, ?)',
      sessionId,
      'efectivo',
    );
  });

  it('exige total = subtotal - descuento y descuento <= subtotal', async () => {
    await expectRejected(
      'INSERT INTO sales (session_id, number, subtotal_cents, discount_cents, total_cents, payment_method) VALUES (?, 4, 1000, 200, 1000, ?)',
      sessionId,
      'efectivo',
    );
    await expectRejected(
      'INSERT INTO sales (session_id, number, subtotal_cents, discount_cents, total_cents, payment_method) VALUES (?, 5, 1000, 1500, -500, ?)',
      sessionId,
      'efectivo',
    );
    await insertSale(sessionId, 6, { subtotal_cents: 1000, discount_cents: 200, total_cents: 800 });
  });

  it('rechaza un método de pago inexistente (FK) y correlativo repetido en la sesión', async () => {
    await expectRejected(
      'INSERT INTO sales (session_id, number, subtotal_cents, total_cents, payment_method) VALUES (?, 7, 100, 100, ?)',
      sessionId,
      'trueque',
    );
    await insertSale(sessionId, 8);
    await expectRejected(
      'INSERT INTO sales (session_id, number, subtotal_cents, total_cents, payment_method) VALUES (?, 8, 100, 100, ?)',
      sessionId,
      'efectivo',
    );
  });

  it('client_uuid, legacy_ref y order_id son únicos (no se duplica una venta)', async () => {
    await insertSale(sessionId, 20, { client_uuid: 'uuid-1', legacy_ref: 'aronium:doc:1' });
    await expectRejected(
      'INSERT INTO sales (session_id, number, subtotal_cents, total_cents, payment_method, client_uuid) VALUES (?, 21, 100, 100, ?, ?)',
      sessionId,
      'efectivo',
      'uuid-1',
    );
    await expectRejected(
      'INSERT INTO sales (session_id, number, subtotal_cents, total_cents, payment_method, legacy_ref) VALUES (?, 22, 100, 100, ?, ?)',
      sessionId,
      'efectivo',
      'aronium:doc:1',
    );
  });

  it('un pedido web se cobra una sola vez (UNIQUE order_id, D7)', async () => {
    const custId = (
      await db
        .prepare("INSERT INTO customers (email, phone, password_hash, name) VALUES ('sale-cust@test.local', '1', 'h', 'C') RETURNING id")
        .first<{ id: number }>()
    )!.id;
    const orderId = (
      await db
        .prepare("INSERT INTO orders (customer_id, code, subtotal) VALUES (?, 'SALE01', 10) RETURNING id")
        .bind(custId)
        .first<{ id: number }>()
    )!.id;
    await insertSale(sessionId, 30, { order_id: orderId });
    await expectRejected(
      'INSERT INTO sales (session_id, number, subtotal_cents, total_cents, payment_method, order_id) VALUES (?, 31, 100, 100, ?, ?)',
      sessionId,
      'efectivo',
      orderId,
    );
  });

  it('una sesión con ventas no se puede borrar (RESTRICT) y sale_items cae en cascada', async () => {
    await expectRejected('DELETE FROM cash_sessions WHERE id = ?', sessionId);

    const saleId = await insertSale(sessionId, 40);
    await run(
      'INSERT INTO sale_items (sale_id, name, unit_price_cents, quantity, line_total_cents) VALUES (?, ?, 1250, 2, 2500)',
      saleId,
      'Pizza Alborada',
    );
    expect(await count('SELECT COUNT(*) AS n FROM sale_items WHERE sale_id = ?', saleId)).toBe(1);
    await run('DELETE FROM sales WHERE id = ?', saleId);
    expect(await count('SELECT COUNT(*) AS n FROM sale_items WHERE sale_id = ?', saleId)).toBe(0);
  });

  it('sale_items rechaza precio/cantidad no positivos y línea que no cuadra', async () => {
    const saleId = await insertSale(sessionId, 41);
    const insert =
      'INSERT INTO sale_items (sale_id, name, unit_price_cents, quantity, line_total_cents) VALUES (?, ?, ?, ?, ?)';
    await expectRejected(insert, saleId, 'X', 0, 1, 0);
    await expectRejected(insert, saleId, 'X', 100, 0, 0);
    await expectRejected(insert, saleId, 'X', 100, 2, 999);
    await run(insert, saleId, 'X', 100, 2, 200);
  });

  it('anular exige timestamp, usuario opcional y motivo juntos o ninguno', async () => {
    const saleId = await insertSale(sessionId, 50);
    await expectRejected("UPDATE sales SET voided_at = datetime('now') WHERE id = ?", saleId);
    await run("UPDATE sales SET voided_at = datetime('now'), void_reason = 'duplicada' WHERE id = ?", saleId);
    await expectRejected("UPDATE sales SET void_reason = NULL WHERE id = ?", saleId);
  });
});

describe('0009 · expenses y expense_categories', () => {
  let categoryId: number;

  beforeAll(async () => {
    categoryId = (
      await db.prepare("SELECT id FROM expense_categories WHERE name = 'Gas'").first<{ id: number }>()
    )!.id;
  });

  it('inserta un gasto con defaults y rechaza monto no positivo', async () => {
    await run(
      "INSERT INTO expenses (date, amount_cents, category_id, payment_method) VALUES ('2026-11-22', 4500, ?, 'efectivo')",
      categoryId,
    );
    const row = await db
      .prepare("SELECT description, paid_from_register, source, deleted_at FROM expenses WHERE date = '2026-11-22'")
      .first<{ description: string; paid_from_register: number; source: string; deleted_at: string | null }>();
    expect(row).toEqual({ description: '', paid_from_register: 0, source: 'manual', deleted_at: null });

    await expectRejected(
      "INSERT INTO expenses (date, amount_cents, category_id, payment_method) VALUES ('2026-11-22', 0, ?, 'efectivo')",
      categoryId,
    );
  });

  it('rechaza fecha mal formada, categoría inexistente y método inexistente', async () => {
    const base = 'INSERT INTO expenses (date, amount_cents, category_id, payment_method) VALUES (?, 100, ?, ?)';
    await expectRejected(base, '22/11/2026', categoryId, 'efectivo');
    await expectRejected(base, '2026-11-22', 99999, 'efectivo');
    await expectRejected(base, '2026-11-22', categoryId, 'trueque');
  });

  it('import_hash es UNIQUE (reimportar HomeBank no duplica, D11)', async () => {
    const insert =
      "INSERT INTO expenses (date, amount_cents, category_id, payment_method, source, import_hash) VALUES ('2026-11-01', 100, ?, 'efectivo', 'homebank', ?)";
    await run(insert, categoryId, 'hash-1');
    await expectRejected(insert, categoryId, 'hash-1');
  });

  it('una categoría con gastos no se puede borrar (RESTRICT)', async () => {
    await expectRejected('DELETE FROM expense_categories WHERE id = ?', categoryId);
  });

  it('no admite dos categorías raíz con el mismo nombre (los NULL no colisionan en UNIQUE)', async () => {
    await expectRejected("INSERT INTO expense_categories (name) VALUES ('Gas')");
  });

  it('UNIQUE(parent_id, name) vale para subcategorías', async () => {
    const insert = 'INSERT INTO expense_categories (name, parent_id) VALUES (?, ?)';
    await run(insert, 'Balón 10kg', categoryId);
    await expectRejected(insert, 'Balón 10kg', categoryId);
    await run(insert, 'Balón 10kg', (await db.prepare("SELECT id FROM expense_categories WHERE name = 'Insumos'").first<{ id: number }>())!.id);
  });
});

describe('0009 · legacy_product_map', () => {
  it('clave primaria (source, legacy_id) y source cerrado a aronium', async () => {
    const insert = "INSERT INTO legacy_product_map (source, legacy_id, legacy_name, legacy_group) VALUES (?, ?, 'Pizza', 'Pizzas Grandes')";
    await run(insert, 'aronium', 1);
    await expectRejected(insert, 'aronium', 1);
    await expectRejected(insert, 'otro', 2);
  });
});
