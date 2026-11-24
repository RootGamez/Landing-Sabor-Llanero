/**
 * Lógica pura del carrito (sin React ni imports de runtime, para probarla con
 * `node --test`, ver `cartLines.test.ts`). `lib/cart.tsx` la re-exporta y le
 * pone encima el Context + localStorage.
 */

export interface CartLine {
  /** Identifica la línea: mismo ítem+tamaño/presentación acumula cantidad, no duplica fila. */
  key: string;
  itemId: number;
  /** Slug del ítem, para armar el anchor de vuelta a /menu (mismo criterio que itemUrl de whatsapp.ts). */
  itemSlug: string;
  /** Nombre ya resuelto en el idioma activo al momento de agregar (snapshot, igual que order_items). */
  name: string;
  /**
   * `null` si el ítem no vende por tamaño ni presentación. Con presentaciones
   * es el id de la presentación elegida. Necesario (no solo el label) para
   * armar `POST /orders` en el checkout logueado (P2.8).
   */
  sizeId: number | null;
  sizeLabel: string | null;
  unitPrice: number;
  quantity: number;
}

export type CartLineInput = Omit<CartLine, "quantity">;

/** Key de línea, genérica para ítems con opción (`sizeId` real) o sin ella (`null`). */
export function buildCartLineKey(itemId: number, sizeId: number | null): string {
  return sizeId != null ? `${itemId}:${sizeId}` : `${itemId}:base`;
}

interface CartLineCandidate {
  item: { id: number; slug: string; price: number | null };
  /** El ítem tiene tamaños o presentaciones (`prices.length > 0`). */
  hasSizes: boolean;
  selectedPrice: { sizeId: number; price: number } | null;
  name: string;
  /** Label de la opción ya resuelto en el idioma activo; ignorado si `!hasSizes`. */
  sizeLabel: string | null;
}

/**
 * Arma el `CartLineInput` para el ítem/opción actualmente seleccionado en una
 * card o en el modal. Devuelve `null` si no hay precio resuelto todavía (ítem
 * con tamaños/presentaciones sin elegir, o `item.price` nulo): así nunca se
 * agrega al carrito un ítem con opciones sin haber elegido una.
 */
export function cartLineFromItem(candidate: CartLineCandidate): CartLineInput | null {
  const { item, hasSizes, selectedPrice, name, sizeLabel } = candidate;
  if (hasSizes) {
    if (!selectedPrice) return null;
    return {
      key: buildCartLineKey(item.id, selectedPrice.sizeId),
      itemId: item.id,
      itemSlug: item.slug,
      name,
      sizeId: selectedPrice.sizeId,
      sizeLabel,
      unitPrice: selectedPrice.price,
    };
  }
  if (item.price == null) return null;
  return {
    key: buildCartLineKey(item.id, null),
    itemId: item.id,
    itemSlug: item.slug,
    name,
    sizeId: null,
    sizeLabel: null,
    unitPrice: item.price,
  };
}

export function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.key === "string" &&
    typeof line.itemId === "number" &&
    typeof line.itemSlug === "string" &&
    typeof line.name === "string" &&
    (line.sizeId === null || typeof line.sizeId === "number") &&
    (line.sizeLabel === null || typeof line.sizeLabel === "string") &&
    typeof line.unitPrice === "number" &&
    typeof line.quantity === "number" &&
    line.quantity > 0
  );
}

/** Opciones vigentes de un ítem de la carta (subconjunto de `MenuItemWithPrices`). */
export interface CatalogItemOptions {
  id: number;
  prices: ReadonlyArray<{ sizeId: number; kind?: "size" | "portion" }>;
}

export type StaleReason = "portion" | "size";

/**
 * Detecta líneas de un carrito viejo (localStorage) que ya no coinciden con la
 * carta: un ítem que ahora tiene presentaciones/tamaños y la línea no trae
 * `sizeId` (o trae uno que ya no existe). La API las rechazaría con 400, así
 * que la UI las marca para que el cliente elija de nuevo. Devuelve, por key de
 * línea, qué tipo de opción hay que elegir. Ítems que no están en la carta
 * (inactivos) se ignoran: no hay con qué comparar.
 */
export function findStaleLines(
  lines: readonly CartLine[],
  items: readonly CatalogItemOptions[],
): Map<string, StaleReason> {
  const byId = new Map(items.map((item) => [item.id, item]));
  const stale = new Map<string, StaleReason>();

  for (const line of lines) {
    const item = byId.get(line.itemId);
    if (!item || item.prices.length === 0) continue;
    const isValid = line.sizeId != null && item.prices.some((price) => price.sizeId === line.sizeId);
    if (isValid) continue;
    stale.set(line.key, item.prices.some((price) => price.kind === "portion") ? "portion" : "size");
  }
  return stale;
}
