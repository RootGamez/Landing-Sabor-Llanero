-- Catálogo de premios con precio/descuento + canje que crea un pedido real
-- en el pipeline orders/order_items existente (en vez de vivir aislado en
-- reward_redemptions como hasta ahora).

-- ── rewards: precio de referencia + precio con descuento ───────────────────
-- price se deja NULLABLE a nivel DB (mismo patrón que menu_items.price,
-- 0001_init.sql) para no reventar premios ya existentes sin precio —
-- "obligatorio" se exige en createRewardSchema (Zod) para todo premio NUEVO,
-- no como NOT NULL de columna. Un premio sin price no se puede canjear (la
-- API lo bloquea explícitamente) hasta que el dueño le cargue un precio.
ALTER TABLE rewards ADD COLUMN price REAL CHECK (price IS NULL OR price > 0);

-- discount_price: el CHECK de un ADD COLUMN solo puede referirse a la columna
-- nueva en soledad (no a `price`, columna hermana) — el invariante cruzado
-- "discount_price < price" se valida en createRewardSchema/updateRewardSchema
-- (superRefine), mismo idiom que validateCategoryPrices/validateMenuItemPrices
-- ya usado en packages/shared/src/validation.ts.
ALTER TABLE rewards ADD COLUMN discount_price REAL CHECK (discount_price IS NULL OR discount_price > 0);

-- ── orders: distingue pedidos de storefront vs. canjes de premio ───────────
-- DEFAULT 'storefront' a propósito: el INSERT existente en POST /orders
-- (routes/orders.ts) no necesita tocarse, hereda el default.
ALTER TABLE orders ADD COLUMN source TEXT NOT NULL DEFAULT 'storefront'
  CHECK (source IN ('storefront', 'reward_redemption'));

-- ── reward_redemptions: enlaza la redención con el pedido real ────────────
-- UNIQUE (no un índice plano): un redeem SIEMPRE crea exactamente un pedido
-- nuevo, 1:1 por construcción — mismo respaldo a nivel DB que ya usa el repo
-- para invariantes equivalentes (raffle_entries.UNIQUE(order_id),
-- idx_ledger_order_once). NULL sigue permitiendo múltiples filas sin pedido
-- (redenciones creadas antes de esta migración).
ALTER TABLE reward_redemptions ADD COLUMN order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX idx_redemptions_order ON reward_redemptions(order_id);

-- ── order_items: item_id pasa a nullable + reward_id nuevo + CHECK ─────────
-- "exactamente uno de los dos". SQLite no permite relajar un NOT NULL
-- existente ni agregar una CHECK multi-columna vía ALTER TABLE — se recrea la
-- tabla, se copian las filas, se dropea la vieja y se renombra.
--
-- Deliberadamente SIN el toggle `PRAGMA foreign_keys = OFF/ON` que sugiere la
-- receta genérica de sqlite.org para este tipo de rebuild: se verificó (grep
-- de `REFERENCES order_items`/`REFERENCES points_ledger` en todas las
-- migraciones) que ninguna otra tabla referencia `order_items` ni
-- `points_ledger` como padre vía FK, así que el DROP TABLE de ninguna de las
-- dos puede quedar bloqueado por el enforcement de foreign keys — el toggle
-- no protegería nada acá. Se omite en vez de dejarlo como no-op sin verificar
-- si D1/wrangler lo soporta igual que SQLite local, ya que esta es la
-- primera migración de este repo que necesita un rebuild de tabla contra la
-- D1 real de producción (ver docs/PLAN_IMPLEMENTACION.md, entrada
-- "Incidente de producción" 2026-09-25): mejor reducir a lo estrictamente
-- necesario que arrastrar una sentencia nunca antes probada contra remoto.
CREATE TABLE order_items_new (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id    INTEGER REFERENCES menu_items(id) ON DELETE RESTRICT,
  reward_id  INTEGER REFERENCES rewards(id) ON DELETE RESTRICT,
  name_es    TEXT NOT NULL,
  name_en    TEXT NOT NULL DEFAULT '',
  size_label TEXT,
  unit_price REAL NOT NULL CHECK (unit_price > 0),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  CHECK (
    (item_id IS NOT NULL AND reward_id IS NULL)
    OR
    (item_id IS NULL AND reward_id IS NOT NULL)
  )
);

INSERT INTO order_items_new (id, order_id, item_id, reward_id, name_es, name_en, size_label, unit_price, quantity)
SELECT id, order_id, item_id, NULL, name_es, name_en, size_label, unit_price, quantity
FROM order_items;

DROP TABLE order_items;
ALTER TABLE order_items_new RENAME TO order_items;

CREATE INDEX idx_orderitems_order  ON order_items(order_id);
CREATE INDEX idx_orderitems_item   ON order_items(item_id);
CREATE INDEX idx_orderitems_reward ON order_items(reward_id);

-- ── points_ledger: nuevo reason para el reembolso al cancelar un canje ─────
-- 'reward_redemption_refunded', no 'manual_adjustment' reutilizado: este es
-- un reembolso automático del sistema, no un ajuste manual del dueño, y
-- points_ledger es "el historial auditable" — conflando ambos degradaría esa
-- auditoría. El CHECK de `reason` ya existe sobre una columna existente →
-- mismo motivo que order_items, requiere reconstruir la tabla.
CREATE TABLE points_ledger_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  delta       INTEGER NOT NULL,
  reason      TEXT NOT NULL CHECK (reason IN (
    'order_confirmed', 'reward_redeemed', 'manual_adjustment', 'reward_redemption_refunded'
  )),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO points_ledger_new (id, customer_id, order_id, delta, reason, created_at)
SELECT id, customer_id, order_id, delta, reason, created_at
FROM points_ledger;

DROP TABLE points_ledger;
ALTER TABLE points_ledger_new RENAME TO points_ledger;

CREATE INDEX idx_ledger_customer ON points_ledger(customer_id);
CREATE INDEX idx_ledger_order    ON points_ledger(order_id);
-- A prueba de reintentos del handler de confirmación: un pedido no puede
-- acreditar puntos dos veces. Índice único parcial, solo sobre la razón
-- 'order_confirmed' (un pedido sí puede tener otras filas de ledger por
-- otros motivos, ej. 'reward_redeemed' + 'reward_redemption_refunded').
CREATE UNIQUE INDEX idx_ledger_order_once ON points_ledger(order_id) WHERE reason = 'order_confirmed';
