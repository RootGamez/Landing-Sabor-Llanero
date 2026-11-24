-- Presentaciones por ítem (ej. Tequeños: Media docena / 1 docena / Docena y media / 2 docenas).
--
-- Migración 100% ADITIVA: agrega dos columnas a `sizes` e inserta 4 filas. No
-- recrea la tabla: `sizes` es FK de category_prices, item_prices, sale_items,
-- dining_tab_items, menu_items y legacy_product_map, y reconstruirla arriesga
-- esas relaciones. Reutilizar `sizes` permite que las presentaciones viajen por
-- el mismo sizeId que los tamaños de pizza (precio por ítem en item_prices,
-- snapshot en sale_items/order_items/dining_tab_items) sin tocar el resto del
-- esquema. El precio de cada presentación vive en item_prices (por ítem);
-- menu_items.price queda como precio base ("1 docena") y para listados "desde".
--
-- Depende de 0001_init.sql (tabla sizes).
--
-- Reversión (D1 no tiene "down"; a mano, tras un respaldo y solo si ninguna fila
-- de item_prices/sale_items/dining_tab_items referencia las presentaciones):
--   DELETE FROM sizes WHERE kind = 'portion';
--   ALTER TABLE sizes DROP COLUMN units;   ALTER TABLE sizes DROP COLUMN kind;

-- ── sizes.kind: separa tamaños de pizza de presentaciones ───────────────────
-- 'size' (default: todas las filas existentes) = Mediana/Grande/Familiar, que
-- exigen cobertura completa por categoría; 'portion' = presentaciones de ítems
-- de categorías sin tamaños. La API filtra por kind para que las pizzas no
-- vean las presentaciones (cobertura de category_prices, promos de pizzas).
ALTER TABLE sizes ADD COLUMN kind TEXT NOT NULL DEFAULT 'size'
  CHECK (kind IN ('size', 'portion'));

-- sizes.units: cuántas unidades trae la presentación (6, 12, 18, 24). NULL para
-- los tamaños de pizza. Permite a futuro contar unidades vendidas en reportes.
ALTER TABLE sizes ADD COLUMN units INTEGER
  CHECK (units IS NULL OR units > 0);

-- ── Las 4 presentaciones estándar ──────────────────────────────────────────
-- display_order 100-103: después de los tamaños (1-3). Estos INSERT son idempotentes: el
-- WHERE NOT EXISTS por key permite re-ejecutar sin duplicar ni pisar los
-- textos que el dueño haya editado desde el CMS.
INSERT INTO sizes (key, label_es, label_en, detail_es, detail_en, display_order, kind, units)
SELECT 'media_docena', 'Media docena', 'Half dozen', '6 unidades', '6 pieces', 100, 'portion', 6
WHERE NOT EXISTS (SELECT 1 FROM sizes WHERE key = 'media_docena');

INSERT INTO sizes (key, label_es, label_en, detail_es, detail_en, display_order, kind, units)
SELECT 'docena', '1 docena', '1 dozen', '12 unidades', '12 pieces', 101, 'portion', 12
WHERE NOT EXISTS (SELECT 1 FROM sizes WHERE key = 'docena');

INSERT INTO sizes (key, label_es, label_en, detail_es, detail_en, display_order, kind, units)
SELECT 'docena_y_media', 'Docena y media', 'Dozen and a half', '18 unidades', '18 pieces', 102, 'portion', 18
WHERE NOT EXISTS (SELECT 1 FROM sizes WHERE key = 'docena_y_media');

INSERT INTO sizes (key, label_es, label_en, detail_es, detail_en, display_order, kind, units)
SELECT 'dos_docenas', '2 docenas', '2 dozen', '24 unidades', '24 pieces', 103, 'portion', 24
WHERE NOT EXISTS (SELECT 1 FROM sizes WHERE key = 'dos_docenas');
