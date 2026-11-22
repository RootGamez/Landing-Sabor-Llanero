-- Catálogo SINTÉTICO para los E2E (no es la carta real). Ids fijos: los tests
-- y support/api.ts dependen de ellos.
INSERT INTO sizes (id, key, label_es, label_en, display_order) VALUES
  (1, 'mediana', 'Mediana', 'Medium', 1),
  (2, 'grande', 'Grande', 'Large', 2);

INSERT INTO categories (id, slug, name_es, has_sizes, display_order) VALUES
  (1, 'pizzas', 'Pizzas', 1, 1),
  (2, 'bebidas', 'Bebidas', 0, 2);

INSERT INTO category_prices (category_id, size_id, price) VALUES
  (1, 1, 20),
  (1, 2, 30);

INSERT INTO menu_items (id, category_id, slug, name_es, price, channel, display_order) VALUES
  (1, 1, 'pizza-demo', 'Pizza Demo', NULL, 'both', 1),
  (2, 2, 'gaseosa-demo', 'Gaseosa Demo', 5.5, 'both', 1),
  (3, 2, 'agua-demo', 'Agua Demo', 3, 'both', 2);
