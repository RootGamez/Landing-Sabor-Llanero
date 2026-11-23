-- Sabores y notas por línea del POS (docs/SABORES_Y_NOTAS.md).
--
-- Migración 100% ADITIVA: solo agrega columnas NULLABLE (las ventas históricas
-- quedan con NULL = "sin sabores, sin nota") y configura las 4 promos de la
-- carta por slug. No reconstruye tablas ni toca datos de ventas.
--
-- Depende de 0010_dining_tables.sql (agrega columnas a dining_tab_items).
--
-- Reversión (D1 no tiene "down"; a mano, tras un respaldo):
--   ALTER TABLE sale_items DROP COLUMN flavors_json;   ALTER TABLE sale_items DROP COLUMN note;
--   ALTER TABLE dining_tab_items DROP COLUMN flavors_json; ALTER TABLE dining_tab_items DROP COLUMN note;
--   ALTER TABLE menu_items DROP COLUMN promo_pizza_count; ALTER TABLE menu_items DROP COLUMN promo_pizza_size_id;
--   (y recrear idx_dining_tab_items_key como estaba en 0010).

-- ── menu_items: promos con pizzas a elegir ──────────────────────────────────
-- promo_pizza_count = cuántas pizzas incluye la promo; promo_pizza_size_id =
-- de qué tamaño. Ambas NULL = el ítem no es una promo de pizzas (no se eligen
-- sabores). El precio de la promo sigue siendo menu_items.price.
ALTER TABLE menu_items ADD COLUMN promo_pizza_count INTEGER
  CHECK (promo_pizza_count IS NULL OR promo_pizza_count BETWEEN 1 AND 6);
ALTER TABLE menu_items ADD COLUMN promo_pizza_size_id INTEGER REFERENCES sizes(id) ON DELETE SET NULL;

-- Promos de la carta 2026 (seed.sql, pág. 9). Por slug: si alguna no existe
-- en esta base, el UPDATE no toca nada. El dueño las ajusta desde el CMS.
UPDATE menu_items SET promo_pizza_count = 1, promo_pizza_size_id = (SELECT id FROM sizes WHERE key = 'grande')
 WHERE slug = 'promo-grande' AND promo_pizza_count IS NULL;
UPDATE menu_items SET promo_pizza_count = 1, promo_pizza_size_id = (SELECT id FROM sizes WHERE key = 'familiar')
 WHERE slug = 'promo-familiar' AND promo_pizza_count IS NULL;
UPDATE menu_items SET promo_pizza_count = 2, promo_pizza_size_id = (SELECT id FROM sizes WHERE key = 'mediana')
 WHERE slug = 'promo-fin-de-semana' AND promo_pizza_count IS NULL;
UPDATE menu_items SET promo_pizza_count = 2, promo_pizza_size_id = (SELECT id FROM sizes WHERE key = 'grande')
 WHERE slug = 'promo-2-grandes' AND promo_pizza_count IS NULL;
-- Si el tamaño no existiera, no dejar la promo a medias (count sin tamaño).
UPDATE menu_items SET promo_pizza_count = NULL WHERE promo_pizza_size_id IS NULL;

-- ── sale_items: sabores + nota (snapshot, igual que name/size_label) ────────
-- flavors_json: {"kind":"pizza"|"promo","pizzas":[{"flavors":[{itemId,name}],
--   "pricedBy":{itemId,name},"categoryName":"…","surchargeCents":200}]}
-- Lo escribe SOLO la API tras tasar server-side; json_valid es la red de seguridad.
ALTER TABLE sale_items ADD COLUMN flavors_json TEXT
  CHECK (flavors_json IS NULL OR (json_valid(flavors_json) AND length(flavors_json) <= 4000));
ALTER TABLE sale_items ADD COLUMN note TEXT
  CHECK (note IS NULL OR length(note) BETWEEN 1 AND 200);

-- ── dining_tab_items (Mesas): mismas columnas, para que la cuenta abierta las
-- conserve hasta el cobro ──────────────────────────────────────────────────
ALTER TABLE dining_tab_items ADD COLUMN flavors_json TEXT
  CHECK (flavors_json IS NULL OR (json_valid(flavors_json) AND length(flavors_json) <= 4000));
ALTER TABLE dining_tab_items ADD COLUMN note TEXT
  CHECK (note IS NULL OR length(note) BETWEEN 1 AND 200);

-- El índice único de 0010 era (cuenta, producto, tamaño): impedía tener en la
-- misma mesa "Hawaiana Grande" y "Hawaiana/Llanera Grande". Se amplía con
-- sabores y nota; para líneas sin sabores ni nota la regla queda IGUAL.
DROP INDEX IF EXISTS idx_dining_tab_items_key;
CREATE UNIQUE INDEX idx_dining_tab_items_line
  ON dining_tab_items(tab_id, item_id, IFNULL(size_id, 0), IFNULL(flavors_json, ''), IFNULL(note, ''))
  WHERE item_id IS NOT NULL;
