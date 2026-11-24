-- Catálogo SINTÉTICO para los E2E (no es la carta real). Ids fijos: los tests
-- y support/api.ts dependen de ellos.

-- La migración 0012 ya sembró las 4 presentaciones con ids automáticos: se vuelven a
-- crear después de los tamaños para que Mediana/Grande conserven los ids 1 y 2.
DELETE FROM sizes;
INSERT INTO sizes (id, key, label_es, label_en, display_order) VALUES
  (1, 'mediana', 'Mediana', 'Medium', 1),
  (2, 'grande', 'Grande', 'Large', 2);
INSERT INTO sizes (id, key, label_es, label_en, detail_es, detail_en, display_order, kind, units) VALUES
  (3, 'media_docena', 'Media docena', 'Half dozen', '6 unidades', '6 pieces', 100, 'portion', 6),
  (4, 'docena', '1 docena', '1 dozen', '12 unidades', '12 pieces', 101, 'portion', 12),
  (5, 'docena_y_media', 'Docena y media', 'Dozen and a half', '18 unidades', '18 pieces', 102, 'portion', 18),
  (6, 'dos_docenas', '2 docenas', '2 dozen', '24 unidades', '24 pieces', 103, 'portion', 24);

INSERT INTO categories (id, slug, name_es, has_sizes, display_order) VALUES
  (1, 'pizzas', 'Pizzas', 1, 1),
  (2, 'bebidas', 'Bebidas', 0, 2),
  (3, 'entradas', 'Entradas', 0, 3);

INSERT INTO category_prices (category_id, size_id, price) VALUES
  (1, 1, 20),
  (1, 2, 30);

INSERT INTO menu_items (id, category_id, slug, name_es, price, channel, display_order) VALUES
  (1, 1, 'pizza-demo', 'Pizza Demo', NULL, 'both', 1),
  (2, 2, 'gaseosa-demo', 'Gaseosa Demo', 5.5, 'both', 1),
  (3, 2, 'agua-demo', 'Agua Demo', 3, 'both', 2),
  (4, 3, 'tequenos-demo', 'Tequeños Demo', 36, 'both', 1);
