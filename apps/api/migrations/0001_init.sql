-- Usuarios: idéntico a Jaw (con token_version y last_login_at desde el día 1,
-- no como migración incremental — acá arrancamos limpios).
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('owner', 'admin')),
  token_version INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tamaños globales del negocio (Mediana/Grande/Familiar). Tabla y no enum para
-- poder agregar "Personal" el día de mañana desde una migración, con labels i18n.
CREATE TABLE sizes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  key           TEXT NOT NULL UNIQUE,        -- 'mediana' | 'grande' | 'familiar'
  label_es      TEXT NOT NULL,               -- 'Mediana'
  label_en      TEXT NOT NULL,               -- 'Medium'
  detail_es     TEXT NOT NULL DEFAULT '',    -- '8 porciones · 30 cm'
  detail_en     TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0
);

-- Categorías bilingües. has_sizes decide el modo de precio:
--   1 → los ítems se venden por tamaño y la categoría define el precio base de cada uno
--   0 → cada ítem tiene su precio propio (entradas, bebidas, promos, combos)
CREATE TABLE categories (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  slug             TEXT NOT NULL UNIQUE,
  name_es          TEXT NOT NULL,
  name_en          TEXT NOT NULL DEFAULT '',
  has_sizes        INTEGER NOT NULL DEFAULT 0,
  display_order    INTEGER NOT NULL DEFAULT 0,
  banner_image_key TEXT,
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Precio por tamaño A NIVEL CATEGORÍA (el default que heredan sus ítems).
-- Solo tiene filas para categorías con has_sizes = 1.
CREATE TABLE category_prices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  size_id     INTEGER NOT NULL REFERENCES sizes(id) ON DELETE RESTRICT,
  price       REAL NOT NULL CHECK (price > 0),
  UNIQUE (category_id, size_id)
);

-- Ítems del menú, bilingües. Sin stock (requisito 4).
--   price: SOLO para ítems de categorías has_sizes = 0 (precio único propio).
CREATE TABLE menu_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id    INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  slug           TEXT NOT NULL UNIQUE,
  name_es        TEXT NOT NULL,
  name_en        TEXT NOT NULL DEFAULT '',
  description_es TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  price          REAL CHECK (price IS NULL OR price > 0),
  is_featured    INTEGER NOT NULL DEFAULT 0,   -- destacado (ej. Pizza Alborada)
  is_active      INTEGER NOT NULL DEFAULT 1,
  display_order  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Override de precio por tamaño A NIVEL ÍTEM (requisito 2). Si no hay fila,
-- rige category_prices. Solo para ítems de categorías has_sizes = 1.
CREATE TABLE item_prices (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  size_id INTEGER NOT NULL REFERENCES sizes(id) ON DELETE RESTRICT,
  price   REAL NOT NULL CHECK (price > 0),
  UNIQUE (item_id, size_id)
);

-- Media de ítems: calcado de product_media de Jaw (claves R2 items/{id}/{uuid}.{ext}).
CREATE TABLE item_media (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id       INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('image', 'video')),
  r2_key        TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Configuración de WhatsApp: igual a Jaw, con plantilla por idioma.
CREATE TABLE whatsapp_config (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number        TEXT NOT NULL,
  message_template_es TEXT NOT NULL DEFAULT
    'Hola 👋 Quiero pedir: *[nombre]* ([tamaño]) — [precio]. [link]',
  message_template_en TEXT NOT NULL DEFAULT
    'Hi 👋 I''d like to order: *[nombre]* ([tamaño]) — [precio]. [link]',
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Analítica de clics de pedido (decisión §7.1 del blueprint: se conserva,
-- costo casi nulo y da "qué pizzas piden más" gratis vía /reports).
CREATE TABLE events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id    INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('view', 'order_click')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_items_category   ON menu_items(category_id);
CREATE INDEX idx_items_active     ON menu_items(is_active);
CREATE INDEX idx_catprices_cat    ON category_prices(category_id);
CREATE INDEX idx_itemprices_item  ON item_prices(item_id);
CREATE INDEX idx_media_item       ON item_media(item_id);
CREATE INDEX idx_events_item      ON events(item_id);
CREATE INDEX idx_events_type_date ON events(type, created_at);
