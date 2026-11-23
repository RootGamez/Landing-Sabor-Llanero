/**
 * Diferencia pura entre lo guardado en una cuenta de mesa y la lista completa
 * que manda el cliente al "Guardar pedido". Sin DB: se testea aislada.
 *
 * Las filas se identifican por (producto, tamaño, sabores, nota), igual que
 * las líneas del ticket del POS (`cartLineIdentity`): cambiar sabores o nota
 * es otra línea (se borra la vieja y se inserta/tasa la nueva). Las filas cuyo producto se borró del menú (`itemId` null) no
 * las puede referenciar el cliente: se conservan tal cual.
 */

import { cartLineIdentity } from '@sabor/shared';

export interface ExistingTabItem {
  id: number;
  itemId: number | null;
  sizeId: number | null;
  quantity: number;
  /** Sabores guardados (itemIds por pizza) y nota; ausentes = sin sabores/nota. */
  flavors?: readonly (readonly number[])[] | null;
  note?: string | null;
}

export interface DesiredTabItem {
  itemId: number;
  sizeId?: number;
  quantity: number;
  flavors?: number[][];
  note?: string;
}

export interface TabItemsDiff {
  /** Productos nuevos en la cuenta (hay que tasarlos server-side). */
  inserts: DesiredTabItem[];
  /** Filas existentes con otra cantidad. */
  updates: Array<{ id: number; quantity: number }>;
  /** Filas existentes que ya no están en la lista. */
  deletes: number[];
  /** `true` si se baja la cantidad o se quita algo ya guardado (requiere owner/admin). */
  reducesSaved: boolean;
}

export function tabItemKey(
  itemId: number,
  sizeId: number | null | undefined,
  flavors?: readonly (readonly number[])[] | null,
  note?: string | null,
): string {
  return cartLineIdentity(itemId, sizeId ?? null, flavors ?? null, note ?? null);
}

export function diffTabItems(existing: readonly ExistingTabItem[], desired: readonly DesiredTabItem[]): TabItemsDiff {
  const saved = new Map<string, ExistingTabItem>();
  for (const row of existing) {
    if (row.itemId !== null) saved.set(tabItemKey(row.itemId, row.sizeId, row.flavors, row.note), row);
  }

  const inserts: DesiredTabItem[] = [];
  const updates: Array<{ id: number; quantity: number }> = [];
  const seen = new Set<string>();
  let reducesSaved = false;

  for (const item of desired) {
    const key = tabItemKey(item.itemId, item.sizeId, item.flavors, item.note);
    seen.add(key);
    const row = saved.get(key);
    if (!row) {
      inserts.push(item);
      continue;
    }
    if (row.quantity !== item.quantity) {
      updates.push({ id: row.id, quantity: item.quantity });
      if (item.quantity < row.quantity) reducesSaved = true;
    }
  }

  const deletes = [...saved.entries()].filter(([key]) => !seen.has(key)).map(([, row]) => row.id);
  if (deletes.length > 0) reducesSaved = true;

  return { inserts, updates, deletes, reducesSaved };
}
