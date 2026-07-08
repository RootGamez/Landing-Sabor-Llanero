/**
 * Portadas de ítem del menú: la primera media (menor display_order) de cada
 * uno. Compartido por el listado de ítems y las secciones del catálogo
 * (evita duplicar la subquery, mismo patrón que coverKeysByProduct en Jaw).
 */
export async function coverKeysByItem(
  db: D1Database,
  itemIds: number[],
): Promise<Map<number, string>> {
  const covers = new Map<number, string>();
  if (itemIds.length === 0) return covers;

  const placeholders = itemIds.map(() => '?').join(',');
  const { results } = await db
    .prepare(
      `SELECT im.item_id, im.r2_key
         FROM item_media im
        WHERE im.item_id IN (${placeholders})
          AND im.display_order = (
            SELECT MIN(display_order) FROM item_media
             WHERE item_id = im.item_id
          )`,
    )
    .bind(...itemIds)
    .all<{ item_id: number; r2_key: string }>();
  for (const row of results) covers.set(row.item_id, row.r2_key);
  return covers;
}
