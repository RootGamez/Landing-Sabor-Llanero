-- Clientes finales. Tabla separada de `users` (staff) a propósito — nunca compartir
-- esa tabla ni su CHECK de role. Ver "Seguridad: JWT de cliente separado" en
-- PLAN_IMPLEMENTACION.md.
CREATE TABLE customers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL UNIQUE,
  phone          TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  name           TEXT NOT NULL,
  points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  token_version  INTEGER NOT NULL DEFAULT 0,
  last_login_at  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- code: identificador corto (ej. "A1B2C3") para referenciar el pedido en WhatsApp y en
-- la card del CMS. subtotal: SIEMPRE recalculado server-side, nunca el que manda el cliente.
CREATE TABLE orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  code           TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled')) DEFAULT 'pending',
  subtotal       REAL NOT NULL CHECK (subtotal >= 0),
  points_awarded INTEGER CHECK (points_awarded IS NULL OR points_awarded >= 0),
  confirmed_at   TEXT,
  confirmed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Snapshot de nombre/precio: el menú puede cambiar después de hecho el pedido.
CREATE TABLE order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  name_es    TEXT NOT NULL,
  name_en    TEXT NOT NULL DEFAULT '',
  size_label TEXT,
  unit_price REAL NOT NULL CHECK (unit_price > 0),
  quantity   INTEGER NOT NULL CHECK (quantity > 0)
);

-- Historial auditable. `customers.points_balance` es el contador rápido desnormalizado
-- (mismo patrón que `token_version`), actualizado atómicamente junto con cada fila acá.
CREATE TABLE points_ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  delta       INTEGER NOT NULL,
  reason      TEXT NOT NULL CHECK (reason IN ('order_confirmed', 'reward_redeemed', 'manual_adjustment')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Catálogo de premios que el dueño arma desde el CMS.
CREATE TABLE rewards (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name_es        TEXT NOT NULL,
  name_en        TEXT NOT NULL DEFAULT '',
  description_es TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  points_cost    INTEGER NOT NULL CHECK (points_cost > 0),
  image_r2_key   TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1,
  display_order  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE reward_redemptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reward_id    INTEGER NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
  points_spent INTEGER NOT NULL CHECK (points_spent > 0),
  status       TEXT NOT NULL CHECK (status IN ('pending', 'fulfilled', 'cancelled')) DEFAULT 'pending',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  fulfilled_at TEXT,
  fulfilled_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- UNIQUE(order_id): una sola entrada por pedido confirmado, a prueba de reintentos del handler.
CREATE TABLE raffle_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id    INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  -- Formato fijo 'YYYY-MM' (ej. '2026-09'): un período mal formado
  -- fragmentaría el pool del sorteo sin que nada lo detecte.
  period      TEXT NOT NULL CHECK (period GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- UNIQUE(period): imposible sortear dos veces el mismo mes.
CREATE TABLE raffle_draws (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  period             TEXT NOT NULL UNIQUE CHECK (period GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  winner_customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  winner_entry_id    INTEGER NOT NULL REFERENCES raffle_entries(id) ON DELETE RESTRICT,
  drawn_at           TEXT NOT NULL DEFAULT (datetime('now')),
  drawn_by           INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

-- Fila única (mismo patrón singleton que whatsapp_config).
CREATE TABLE loyalty_config (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  points_per_currency_unit    REAL NOT NULL DEFAULT 1 CHECK (points_per_currency_unit > 0),
  min_order_amount_for_points REAL NOT NULL DEFAULT 0 CHECK (min_order_amount_for_points >= 0),
  updated_at                  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_orders_customer      ON orders(customer_id);
CREATE INDEX idx_orders_status        ON orders(status);
CREATE INDEX idx_orderitems_order     ON order_items(order_id);
CREATE INDEX idx_orderitems_item      ON order_items(item_id);
CREATE INDEX idx_ledger_customer      ON points_ledger(customer_id);
CREATE INDEX idx_raffle_period        ON raffle_entries(period);
CREATE INDEX idx_raffle_customer      ON raffle_entries(customer_id);
CREATE INDEX idx_redemptions_customer ON reward_redemptions(customer_id);
CREATE INDEX idx_redemptions_reward   ON reward_redemptions(reward_id);
CREATE INDEX idx_redemptions_status   ON reward_redemptions(status);

-- A prueba de reintentos del handler de confirmación (mismo motivo que
-- UNIQUE(order_id) en raffle_entries): un pedido no puede acreditar puntos
-- dos veces. Índice único parcial, solo sobre la razón 'order_confirmed'
-- (un pedido sí puede tener otras filas de ledger por otros motivos).
CREATE UNIQUE INDEX idx_ledger_order_once ON points_ledger(order_id) WHERE reason = 'order_confirmed';
