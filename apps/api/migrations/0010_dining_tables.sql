-- Mesas del local (POS "Mesas"): plano + cuentas abiertas por mesa.
--
-- Migración 100% ADITIVA: solo crea tablas e índices nuevos y siembra el plano
-- por defecto. No toca `sales`, `sale_items` ni `cash_sessions`.
--
-- Decisión de modelado: la cuenta abierta de una mesa NO es una venta con un
-- estado "abierta" sino una fila de `dining_tabs` aparte. `sales` exige
-- session_id y payment_method NOT NULL (una cuenta abierta todavía no tiene
-- ninguno de los dos) y TODAS las consultas de reportes, cierres de caja e
-- historial suman `sales` sin filtrar por estado: meter cuentas abiertas ahí
-- obligaba a reconstruir la tabla y a tocar cada consulta. Con tablas
-- separadas, lo no cobrado es invisible para los reportes por construcción; al
-- cobrar se crea la venta normal (mismo `insertSale` del mostrador) y la cuenta
-- pasa a 'paid' con `sale_id`, todo en un único `DB.batch` (transacción).
--
-- Dinero en céntimos INTEGER y timestamps UTC con datetime('now'), igual que
-- 0009_backoffice.sql.
--
-- Reversión (D1 no tiene "down"; correr a mano tras un respaldo, en este orden):
--   DROP TABLE dining_tab_items;
--   DROP TABLE dining_tabs;
--   DROP TABLE dining_tables;
-- Las ventas ya cobradas desde mesas quedan intactas en `sales`.

-- ── dining_tables: el plano ─────────────────────────────────────────────────
-- Posición y tamaño en celdas de una grilla de 12 columnas (x/y desde 0); el
-- CMS las escala a porcentajes, así el plano mantiene la distribución en
-- cualquier ancho. No se borran: se desactivan (`is_active`), porque las
-- cuentas viejas las referencian.
CREATE TABLE dining_tables (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  label         TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(label)) BETWEEN 1 AND 20),
  x             INTEGER NOT NULL CHECK (x >= 0),
  y             INTEGER NOT NULL CHECK (y >= 0),
  w             INTEGER NOT NULL CHECK (w BETWEEN 1 AND 6),
  h             INTEGER NOT NULL CHECK (h BETWEEN 1 AND 4),
  shape         TEXT NOT NULL DEFAULT 'rect' CHECK (shape IN ('rect', 'round')),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (x + w <= 12),
  CHECK (y + h <= 16)
);

CREATE UNIQUE INDEX idx_dining_tables_label ON dining_tables(label);

-- ── dining_tabs: la cuenta de una mesa ──────────────────────────────────────
-- status: 'open' (consumiendo, no cuenta como ingreso) → 'paid' (cobrada: hay
-- venta en `sales`) | 'void' (anulada con motivo, sin ingreso).
-- version: sube en cada guardado; el cliente manda la que vio y la API
-- rechaza con 409 si otra persona guardó en el medio (control optimista).
-- client_uuid: generado por la API al abrir; se reutiliza como
-- `sales.client_uuid` al cobrar → cobrar dos veces la misma cuenta choca con el
-- UNIQUE de ventas y nunca duplica la venta (idempotencia).
CREATE TABLE dining_tabs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id    INTEGER NOT NULL REFERENCES dining_tables(id) ON DELETE RESTRICT,
  client_uuid TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'void')),
  version     INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  opened_at   TEXT NOT NULL DEFAULT (datetime('now')),
  opened_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  closed_at   TEXT,
  closed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sale_id     INTEGER UNIQUE REFERENCES sales(id) ON DELETE RESTRICT,
  void_reason TEXT,
  CHECK (
    (status = 'open' AND closed_at IS NULL AND sale_id IS NULL AND void_reason IS NULL)
    OR (status = 'paid' AND closed_at IS NOT NULL AND sale_id IS NOT NULL AND void_reason IS NULL)
    OR (status = 'void' AND closed_at IS NOT NULL AND sale_id IS NULL AND void_reason IS NOT NULL)
  )
);

-- UNA sola cuenta abierta por mesa, garantizado por la DB (dos mozos abriendo
-- la misma mesa a la vez: el segundo INSERT falla y la API responde 409).
CREATE UNIQUE INDEX idx_dining_tabs_one_open ON dining_tabs(table_id) WHERE status = 'open';
CREATE INDEX idx_dining_tabs_table ON dining_tabs(table_id);

-- ── dining_tab_items: lo pedido ─────────────────────────────────────────────
-- Snapshot de nombre/tamaño/precio al agregar (igual que sale_items): si el
-- menú cambia de precio con la mesa abierta, lo ya pedido conserva su precio.
-- Una fila por (producto, tamaño): una nueva tanda del mismo producto suma
-- cantidad. item_id/size_id SET NULL para no bloquear el borrado del menú.
CREATE TABLE dining_tab_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tab_id           INTEGER NOT NULL REFERENCES dining_tabs(id) ON DELETE CASCADE,
  item_id          INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
  size_id          INTEGER REFERENCES sizes(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  size_label       TEXT,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),
  quantity         INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_dining_tab_items_tab ON dining_tab_items(tab_id);
CREATE UNIQUE INDEX idx_dining_tab_items_key
  ON dining_tab_items(tab_id, item_id, IFNULL(size_id, 0)) WHERE item_id IS NOT NULL;

-- ── Plano por defecto (dibujo del dueño) ────────────────────────────────────
-- Columna izquierda, de arriba hacia abajo: 3, 2, 1 (rectángulos anchos 4×2).
-- Columna derecha: 4 arriba y 5 abajo (cuadradas 2×2).
INSERT INTO dining_tables (label, x, y, w, h, shape, display_order) VALUES
  ('1', 1, 6, 4, 2, 'rect', 1),
  ('2', 1, 3, 4, 2, 'rect', 2),
  ('3', 1, 0, 4, 2, 'rect', 3),
  ('4', 7, 2, 2, 2, 'rect', 4),
  ('5', 7, 5, 2, 2, 'rect', 5);
