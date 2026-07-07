-- Colecciones de merchandising configurables desde el CMS: el dueño decide
-- qué ítems aparecen en "más pedidos", "promos especiales" y "destacados del
-- día" en el catálogo público. Las claves son fijas y cerradas (ver
-- COLLECTION_KEYS en @sabor/shared); lo editable por fila es título/activo/orden.
CREATE TABLE collections (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  key           TEXT NOT NULL UNIQUE,      -- 'top_sellers' | 'daily_featured' | 'promos'
  title_es      TEXT NOT NULL,
  title_en      TEXT NOT NULL DEFAULT '',
  is_active     INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0
);

-- Ítems curados a mano dentro de cada colección (el dueño los elige uno por
-- uno desde el CMS; no se calculan por ventas ni nada automático).
-- display_order define el orden de aparición dentro de la colección.
CREATE TABLE collection_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  item_id       INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (collection_id, item_id)
);

CREATE INDEX idx_collection_items_collection ON collection_items(collection_id);
CREATE INDEX idx_collection_items_item       ON collection_items(item_id);

-- Seed de las 3 colecciones del negocio: es estructura fija (siempre existen,
-- el dueño no las crea ni las borra), no dato de demo -> va en la migración
-- y no en seed.sql, para que exista también en producción.
INSERT OR IGNORE INTO collections (key, title_es, title_en, display_order) VALUES
  ('top_sellers',    'Los más pedidos',    'Best sellers',       0),
  ('daily_featured', 'Destacados del día', 'Today''s specials',  1),
  ('promos',         'Promos especiales',  'Special deals',      2);
