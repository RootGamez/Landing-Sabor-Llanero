-- Seed mínimo para desarrollo local (BLUEPRINT §4.1). Idempotente donde D1 lo
-- permite: sizes/categories tienen UNIQUE(key)/UNIQUE(slug) -> INSERT OR IGNORE;
-- category_prices tiene UNIQUE(category_id, size_id) -> INSERT OR IGNORE vía
-- subquery por slug/key (no se puede asumir el autoincrement de un run previo);
-- whatsapp_config no tiene una clave natural -> se guarda con WHERE NOT EXISTS.

-- Tamaños del negocio.
INSERT OR IGNORE INTO sizes (key, label_es, label_en, detail_es, detail_en, display_order) VALUES
  ('mediana',  'Mediana', 'Medium', '6 porciones · 25 cm', '6 slices · 25 cm', 0),
  ('grande',   'Grande',  'Large',  '8 porciones · 30 cm', '8 slices · 30 cm', 1),
  ('familiar', 'Familiar','Family', '12 porciones · 35 cm','12 slices · 35 cm', 2);

-- Categorías de ejemplo. Clásicas/Especiales venden por tamaño (has_sizes=1);
-- Entradas/Bebidas/Promos/Combos tienen precio propio por ítem (has_sizes=0).
INSERT OR IGNORE INTO categories (slug, name_es, name_en, has_sizes, display_order) VALUES
  ('clasicas',  'Clásicas',  'Classics',  1, 0),
  ('especiales','Especiales','Specials',  1, 1),
  ('entradas',  'Entradas',  'Starters',  0, 2),
  ('bebidas',   'Bebidas',   'Drinks',    0, 3),
  ('promos',    'Promos',    'Deals',     0, 4),
  ('combos',    'Combos',    'Combos',    0, 5);

-- Precios por tamaño de "Clásicas": 25 / 35 / 45.
INSERT OR IGNORE INTO category_prices (category_id, size_id, price)
  SELECT c.id, s.id, 25 FROM categories c, sizes s WHERE c.slug = 'clasicas' AND s.key = 'mediana';
INSERT OR IGNORE INTO category_prices (category_id, size_id, price)
  SELECT c.id, s.id, 35 FROM categories c, sizes s WHERE c.slug = 'clasicas' AND s.key = 'grande';
INSERT OR IGNORE INTO category_prices (category_id, size_id, price)
  SELECT c.id, s.id, 45 FROM categories c, sizes s WHERE c.slug = 'clasicas' AND s.key = 'familiar';

-- Precios por tamaño de "Especiales": 30 / 40 / 50.
INSERT OR IGNORE INTO category_prices (category_id, size_id, price)
  SELECT c.id, s.id, 30 FROM categories c, sizes s WHERE c.slug = 'especiales' AND s.key = 'mediana';
INSERT OR IGNORE INTO category_prices (category_id, size_id, price)
  SELECT c.id, s.id, 40 FROM categories c, sizes s WHERE c.slug = 'especiales' AND s.key = 'grande';
INSERT OR IGNORE INTO category_prices (category_id, size_id, price)
  SELECT c.id, s.id, 50 FROM categories c, sizes s WHERE c.slug = 'especiales' AND s.key = 'familiar';

-- Configuración de WhatsApp (BLUEPRINT §4.1: plantillas es/en con [tamaño]).
INSERT INTO whatsapp_config (phone_number, message_template_es, message_template_en)
  SELECT
    '51932770766',
    'Hola 👋 Quiero pedir: *[nombre]* ([tamaño]) — [precio]. [link]',
    'Hi 👋 I''d like to order: *[nombre]* ([tamaño]) — [precio]. [link]'
  WHERE NOT EXISTS (SELECT 1 FROM whatsapp_config);
