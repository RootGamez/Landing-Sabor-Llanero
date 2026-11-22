-- Back-office (Plan Parte 3, docs/PLAN_BACKOFFICE.md): POS, caja, ventas, gastos.
-- Dinero SIEMPRE en céntimos INTEGER (`*_cents`, decisión D1) en todas las
-- tablas nuevas. Las tablas viejas (REAL) no se tocan: el puente entre ambas
-- es toCents/fromCents de packages/shared. Los timestamps van en UTC con
-- datetime('now'), igual que el resto del repo (D2): el "día" de Lima se
-- calcula al leer, nunca se guarda.

-- ── users.role: sumar 'cashier' (D9) ───────────────────────────────────────
-- El CHECK de `role` vive sobre una columna existente → SQLite no deja
-- modificarlo con ALTER TABLE, hay que recrear la tabla (mismo motivo que
-- 0005 con order_items).
--
-- OJO, acá NO sirve la receta de 0005 tal cual. En 0005 se verificó que
-- ninguna tabla referenciaba como padre a las tablas reconstruidas, así que
-- el DROP era inocuo. `users` SÍ es padre por FK de cuatro tablas (grep de
-- `REFERENCES users` en 0003/0004):
--   password_reset_tokens.user_id   ON DELETE CASCADE
--   orders.confirmed_by             ON DELETE SET NULL
--   reward_redemptions.fulfilled_by ON DELETE SET NULL
--   raffle_draws.drawn_by           ON DELETE RESTRICT
-- Con foreign keys activas (D1 las fuerza), `DROP TABLE users` hace un
-- DELETE implícito de todas sus filas que DISPARA esas acciones: borraría los
-- tokens de reset, anularía la auditoría de quién confirmó pedidos/canjes y
-- fallaría por RESTRICT apenas existiera un sorteo en producción.
--
-- Enfoques descartados (el segundo se probó y falla):
--   · `PRAGMA foreign_keys = OFF`: es un no-op dentro de una transacción y no
--     se sabe si D1 lo respeta en migraciones remotas (primera migración del
--     repo que reconstruye un padre contra la D1 real).
--   · RENAME de users a users_old + CREATE users nueva (con legacy_alter_table
--     = ON): con foreign keys activas SQLite IGUAL reescribe las FK hijas a
--     users_old, y al dropearla las hijas quedan rotas ("no such table
--     main.users_old"). Lo detectó la suite de tests.
--
-- Enfoque elegido, sin ningún PRAGMA: resguardar las filas hijas que las
-- acciones de FK destruirían, hacer el rebuild clásico (crear users_new,
-- copiar con los MISMOS ids, dropear users, renombrar) y restaurar. Las FK
-- hijas dicen `REFERENCES users(id)` textual, así que al renombrar users_new
-- a users vuelven a resolver sin reescribir nada. Orden obligatorio:
--   1. users_new con el CHECK ampliado + copia de filas.
--   2. Respaldo (tablas _bk_*) de lo que el DROP tocaría: tokens (CASCADE),
--      orders.confirmed_by y reward_redemptions.fulfilled_by (SET NULL) y
--      raffle_draws completa (RESTRICT no se puede diferir: se vacía antes).
--   3. DROP users (ya sin efectos colaterales) y RENAME users_new → users.
--   4. Restauración desde los respaldos y limpieza de _bk_*.
-- Verificado en apps/api/test/migration-0009-backoffice.test.ts: filas hijas
-- intactas, foreign_key_list → users y foreign_key_check vacío.
-- Limitación conocida y aceptada: el contador AUTOINCREMENT de users se
-- reinicia en MAX(id), no en el máximo histórico.
CREATE TABLE users_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'cashier')),
  token_version INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users_new (id, email, password_hash, name, role, token_version, last_login_at, created_at)
SELECT id, email, password_hash, name, role, token_version, last_login_at, created_at
FROM users;

CREATE TABLE _bk_reset_tokens AS SELECT * FROM password_reset_tokens;
CREATE TABLE _bk_order_confirmers AS SELECT id, confirmed_by FROM orders WHERE confirmed_by IS NOT NULL;
CREATE TABLE _bk_redemption_fulfillers AS SELECT id, fulfilled_by FROM reward_redemptions WHERE fulfilled_by IS NOT NULL;
CREATE TABLE _bk_raffle_draws AS SELECT * FROM raffle_draws;

DELETE FROM raffle_draws;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
SELECT id, user_id, token_hash, expires_at, used_at, created_at FROM _bk_reset_tokens;
UPDATE orders SET confirmed_by = (SELECT confirmed_by FROM _bk_order_confirmers b WHERE b.id = orders.id)
WHERE id IN (SELECT id FROM _bk_order_confirmers);
UPDATE reward_redemptions SET fulfilled_by = (SELECT fulfilled_by FROM _bk_redemption_fulfillers b WHERE b.id = reward_redemptions.id)
WHERE id IN (SELECT id FROM _bk_redemption_fulfillers);
INSERT INTO raffle_draws (id, period, winner_customer_id, winner_entry_id, drawn_at, drawn_by)
SELECT id, period, winner_customer_id, winner_entry_id, drawn_at, drawn_by FROM _bk_raffle_draws;

DROP TABLE _bk_reset_tokens;
DROP TABLE _bk_order_confirmers;
DROP TABLE _bk_redemption_fulfillers;
DROP TABLE _bk_raffle_draws;

-- ── menu_items.channel: dónde se vende cada ítem (D6) ──────────────────────
-- 'both' por defecto → todo el menú actual sigue visible en la web sin
-- tocar datos. 'pos' = solo mostrador (ej. gaseosas sueltas), 'web' = solo
-- tienda online. La web pública filtra channel IN ('both','web'), el POS
-- channel IN ('both','pos').
ALTER TABLE menu_items ADD COLUMN channel TEXT NOT NULL DEFAULT 'both'
  CHECK (channel IN ('both', 'web', 'pos'));

-- ── payment_methods (D8) ───────────────────────────────────────────────────
-- Tabla y no enum, igual que `sizes`: el dueño podría sumar "Agora" o
-- "Contraentrega" desde una migración con su label. `key` es la clave estable
-- que referencian ventas y gastos.
CREATE TABLE payment_methods (
  key           TEXT PRIMARY KEY CHECK (key GLOB '[a-z]*' AND key NOT GLOB '*[^a-z0-9_]*'),
  label         TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

INSERT INTO payment_methods (key, label, display_order) VALUES
  ('efectivo',      'Efectivo',      1),
  ('yape',          'Yape',          2),
  ('plin',          'Plin',          3),
  ('tarjeta',       'Tarjeta',       4),
  ('transferencia', 'Transferencia', 5);

-- ── cash_sessions: el "día" de ventas es la sesión de caja (D3) ────────────
-- expected_cash_cents / counted_cash_cents / close_snapshot_json se llenan al
-- cerrar: el snapshot congela el cierre para regenerar la imagen sin
-- recalcular (F5). `source` distingue sesiones del POS de las históricas
-- importadas (Aronium → cierres Z reales, HomeBank → un cierre por día) y
-- `legacy_ref` hace idempotente la importación (D11).
-- opened_by/closed_by SET NULL: borrar un usuario no debe borrar caja.
CREATE TABLE cash_sessions (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  opened_at           TEXT NOT NULL DEFAULT (datetime('now')),
  opened_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  opening_cash_cents  INTEGER NOT NULL DEFAULT 0 CHECK (opening_cash_cents >= 0),
  closed_at           TEXT,
  closed_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  counted_cash_cents  INTEGER CHECK (counted_cash_cents IS NULL OR counted_cash_cents >= 0),
  expected_cash_cents INTEGER CHECK (expected_cash_cents IS NULL OR expected_cash_cents >= 0),
  notes               TEXT NOT NULL DEFAULT '',
  close_snapshot_json TEXT CHECK (close_snapshot_json IS NULL OR json_valid(close_snapshot_json)),
  source              TEXT NOT NULL DEFAULT 'pos' CHECK (source IN ('pos', 'aronium', 'homebank')),
  legacy_ref          TEXT UNIQUE
);

-- Una sola caja abierta a la vez, garantizado por la DB y no solo por la API
-- (dos celulares abriendo caja a la vez no pueden crear dos). Índice único
-- parcial sobre una constante: todas las filas abiertas colisionan entre sí.
CREATE UNIQUE INDEX idx_cash_sessions_one_open ON cash_sessions((1)) WHERE closed_at IS NULL;
CREATE INDEX idx_cash_sessions_opened_at ON cash_sessions(opened_at);

-- ── sales: las ventas no se borran, se anulan (D4) ─────────────────────────
-- session_id RESTRICT: una sesión con ventas jamás se borra (la contabilidad
-- depende de ella). number = correlativo dentro de la sesión (UNIQUE por
-- sesión). total = subtotal - descuento se exige en la DB: el servidor lo
-- recalcula siempre (D12), el CHECK es la red de seguridad. client_uuid
-- UNIQUE → reintentar un POST no duplica la venta y deja la puerta abierta al
-- modo offline sin otra migración (D13). order_id UNIQUE → un pedido web se
-- cobra una sola vez, sin doble conteo en el dashboard (D7).
-- Anulación: voided_at y void_reason van juntos o ninguno (no hay anulación
-- sin motivo auditable). voided_by puede quedar NULL si borran al usuario.
CREATE TABLE sales (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id          INTEGER NOT NULL REFERENCES cash_sessions(id) ON DELETE RESTRICT,
  number              INTEGER NOT NULL CHECK (number > 0),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subtotal_cents      INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  discount_cents      INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0 AND discount_cents <= subtotal_cents),
  total_cents         INTEGER NOT NULL CHECK (total_cents >= 0),
  payment_method      TEXT NOT NULL REFERENCES payment_methods(key) ON DELETE RESTRICT,
  cash_received_cents INTEGER CHECK (cash_received_cents IS NULL OR cash_received_cents >= 0),
  order_id            INTEGER UNIQUE REFERENCES orders(id) ON DELETE SET NULL,
  client_uuid         TEXT UNIQUE,
  voided_at           TEXT,
  voided_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  void_reason         TEXT,
  source              TEXT NOT NULL DEFAULT 'pos' CHECK (source IN ('pos', 'aronium', 'homebank')),
  legacy_ref          TEXT UNIQUE,
  UNIQUE (session_id, number),
  CHECK (total_cents = subtotal_cents - discount_cents),
  CHECK (
    (voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL)
    OR
    (voided_at IS NOT NULL AND void_reason IS NOT NULL)
  )
);

CREATE INDEX idx_sales_session ON sales(session_id);
CREATE INDEX idx_sales_created ON sales(created_at);

-- Snapshot de nombre/tamaño/precio (D5), igual que order_items: el menú puede
-- cambiar después. item_id/size_id SET NULL: borrar un ítem del menú no debe
-- romper el historial, el nombre ya quedó copiado. line_total_cents se valida
-- contra precio × cantidad.
CREATE TABLE sale_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id          INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  item_id          INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
  size_id          INTEGER REFERENCES sizes(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  size_label       TEXT,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents > 0),
  CHECK (line_total_cents = unit_price_cents * quantity)
);

CREATE INDEX idx_saleitems_sale ON sale_items(sale_id);
CREATE INDEX idx_saleitems_item ON sale_items(item_id);

-- ── expense_categories ─────────────────────────────────────────────────────
-- Dos niveles vía parent_id (HomeBank exporta "Padre:Hija"). UNIQUE(parent_id,
-- name) NO alcanza para las raíces porque en SQLite los NULL son distintos
-- entre sí: por eso el índice único parcial aparte sobre las categorías raíz.
CREATE TABLE expense_categories (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL CHECK (length(trim(name)) > 0),
  parent_id INTEGER REFERENCES expense_categories(id) ON DELETE RESTRICT,
  -- D1 limita los patrones LIKE/GLOB a 50 bytes: '#RRGGBB' se valida en dos partes (largo + dígitos hex).
  color     TEXT CHECK (color IS NULL OR (length(color) = 7 AND color GLOB '#*' AND substr(color, 2) NOT GLOB '*[^0-9a-fA-F]*')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  UNIQUE (parent_id, name)
);

CREATE UNIQUE INDEX idx_expcat_root_name ON expense_categories(name) WHERE parent_id IS NULL;
CREATE INDEX idx_expcat_parent ON expense_categories(parent_id);

INSERT INTO expense_categories (name) VALUES
  ('Insumos'), ('Bebidas'), ('Gas'), ('Personal'), ('Servicios'),
  ('Alquiler'), ('Delivery'), ('Mantenimiento'), ('Otros');

-- ── expenses: borrado lógico (D10) ─────────────────────────────────────────
-- date = día LOCAL de Lima 'YYYY-MM-DD' (el dueño anota "gasté hoy", no una
-- hora UTC). category_id RESTRICT: no se borra una categoría con gastos, se
-- desactiva. paid_from_register descuenta del efectivo esperado de la sesión
-- abierta. import_hash UNIQUE → reimportar el mismo .xhb reporta 0 nuevos
-- (D11).
CREATE TABLE expenses (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  date                TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  amount_cents        INTEGER NOT NULL CHECK (amount_cents > 0),
  category_id         INTEGER NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  description         TEXT NOT NULL DEFAULT '',
  payment_method      TEXT NOT NULL REFERENCES payment_methods(key) ON DELETE RESTRICT,
  paid_from_register  INTEGER NOT NULL DEFAULT 0 CHECK (paid_from_register IN (0, 1)),
  session_id          INTEGER REFERENCES cash_sessions(id) ON DELETE SET NULL,
  source              TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'homebank')),
  import_hash         TEXT UNIQUE,
  created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at          TEXT
);

CREATE INDEX idx_expenses_date     ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_expenses_session  ON expenses(session_id);

-- ── legacy_product_map: Aronium → menú actual (F8) ─────────────────────────
-- Mapea (grupo, nombre) de Aronium a (menu_item, size). El tamaño viene en el
-- grupo ("Pizzas Grandes"). item_id/size_id quedan NULL mientras el dueño
-- revisa el CSV de mapeo. source cerrado a 'aronium' por ahora.
CREATE TABLE legacy_product_map (
  source       TEXT NOT NULL CHECK (source IN ('aronium')),
  legacy_id    INTEGER NOT NULL,
  legacy_name  TEXT NOT NULL,
  legacy_group TEXT NOT NULL DEFAULT '',
  item_id      INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
  size_id      INTEGER REFERENCES sizes(id) ON DELETE SET NULL,
  PRIMARY KEY (source, legacy_id)
);
