/**
 * Lógica pura del ticket del POS (sin React ni DOM): líneas, totales, parseo
 * de montos y atajos de efectivo. Todo en céntimos enteros (D1) y con
 * operaciones inmutables. El servidor recalcula precios y totales; esto solo
 * alimenta la pantalla.
 */
import {
  MAX_CENTS,
  ORDER_ITEMS_MAX,
  cartLineIdentity,
  type CreateSaleInput,
  type SaleItemFlavors,
} from '@sabor/shared';

export const MAX_LINE_QUANTITY = 99;
export const MAX_CART_LINES = ORDER_ITEMS_MAX;

/** Billetes que se ofrecen como atajo de "recibido" (solo los que cubren el total). */
const CASH_SHORTCUTS_CENTS = [2_000, 5_000, 10_000, 20_000] as const;

export interface CartLine {
  /**
   * Identidad de la línea: `itemId:sizeId` + sabores + nota (ver `lineKeyOf`).
   * Mismo producto, tamaño, sabores y nota suman cantidad; si algo difiere es otra línea.
   */
  key: string;
  itemId: number;
  sizeId: number | null;
  name: string;
  sizeLabel: string | null;
  unitPriceCents: number;
  quantity: number;
  /** Sabores elegidos: itemIds por pizza (null/ausente = sin sabores). */
  flavors?: number[][] | null;
  /** Cómo se tasaron los sabores (precio del más caro, adicionales): solo para mostrar. */
  flavorInfo?: SaleItemFlavors | null;
  /** Nota libre ya saneada ("sin cebolla"). */
  note?: string | null;
}

export type NewCartLine = Omit<CartLine, 'key' | 'quantity'>;

/** Clave histórica (sin sabores ni nota). */
export function lineKey(itemId: number, sizeId: number | null): string {
  return `${itemId}:${sizeId ?? 0}`;
}

/** Clave completa de una línea: incluye sabores y nota (idéntica a `lineKey` si no tiene ninguno). */
export function lineKeyOf(line: Pick<CartLine, 'itemId' | 'sizeId' | 'flavors' | 'note'>): string {
  return cartLineIdentity(line.itemId, line.sizeId, line.flavors ?? null, line.note ?? null);
}

/** Cambios de sabores/nota sobre una línea ya agregada (con el precio recalculado en vivo). */
export interface LineDetailsPatch {
  flavors?: number[][] | null;
  flavorInfo?: SaleItemFlavors | null;
  note?: string | null;
  unitPriceCents?: number;
}

/**
 * Edita sabores/nota de una línea. La clave cambia con ellos: si choca con
 * otra línea idéntica, se fusionan sumando cantidades (respetando el tope).
 */
export function updateLineDetails(lines: readonly CartLine[], key: string, patch: LineDetailsPatch): CartLine[] {
  const target = lines.find((line) => line.key === key);
  if (!target) return [...lines];
  const merged: CartLine = { ...target, ...patch };
  const updated = { ...merged, key: lineKeyOf(merged) };
  const twin = lines.find((line) => line.key === updated.key && line.key !== key);
  if (!twin) return lines.map((line) => (line.key === key ? updated : line));
  return lines.flatMap((line) => {
    if (line.key === key) return [];
    if (line.key === twin.key) return [{ ...twin, quantity: Math.min(twin.quantity + target.quantity, MAX_LINE_QUANTITY) }];
    return [line];
  });
}

export function lineTotal(line: CartLine): number {
  return line.unitPriceCents * line.quantity;
}

export function cartSubtotal(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

export function cartCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** Total a cobrar: el descuento nunca supera el subtotal. */
export function cartTotal(lines: readonly CartLine[], discountCents: number): number {
  const subtotal = cartSubtotal(lines);
  return subtotal - Math.min(Math.max(discountCents, 0), subtotal);
}

/** Suma 1 a la línea existente o la agrega al final. Respeta los topes de cantidad y de líneas. */
export function addLine(lines: readonly CartLine[], next: NewCartLine): CartLine[] {
  const key = lineKeyOf(next);
  if (lines.some((line) => line.key === key)) {
    return lines.map((line) =>
      line.key === key ? { ...line, quantity: Math.min(line.quantity + 1, MAX_LINE_QUANTITY) } : line,
    );
  }
  if (lines.length >= MAX_CART_LINES) return [...lines];
  return [...lines, { ...next, key, quantity: 1 }];
}

/** Cambia la cantidad de una línea; llegar a 0 la quita. */
export function changeQuantity(lines: readonly CartLine[], key: string, delta: number): CartLine[] {
  return lines.flatMap((line) => {
    if (line.key !== key) return [line];
    const quantity = Math.min(line.quantity + delta, MAX_LINE_QUANTITY);
    return quantity > 0 ? [{ ...line, quantity }] : [];
  });
}

export function removeLine(lines: readonly CartLine[], key: string): CartLine[] {
  return lines.filter((line) => line.key !== key);
}

export interface PriceSource {
  name: string;
  sizeLabel: string | null;
  unitPriceCents: number;
  /** Solo líneas con sabores: tasación vigente de esos sabores. */
  flavorInfo?: SaleItemFlavors | null;
}

/**
 * Alinea nombre y precio de las líneas con el catálogo vigente (un carrito
 * restaurado tras un refresh pudo quedar viejo). Devuelve las líneas que ya no
 * existen en `removed` para avisar al cajero en vez de descartarlas en silencio.
 * `lookup` recibe la línea completa para re-tasar sus sabores si los tiene.
 */
export function repriceLines(
  lines: readonly CartLine[],
  lookup: (itemId: number, sizeId: number | null, line?: CartLine) => PriceSource | undefined,
): { lines: CartLine[]; removed: CartLine[]; changed: boolean } {
  const kept: CartLine[] = [];
  const removed: CartLine[] = [];
  let changed = false;
  for (const line of lines) {
    const source = lookup(line.itemId, line.sizeId, line);
    if (!source) {
      removed.push(line);
      changed = true;
      continue;
    }
    const same =
      source.unitPriceCents === line.unitPriceCents &&
      source.name === line.name &&
      source.sizeLabel === line.sizeLabel &&
      (source.flavorInfo === undefined || JSON.stringify(source.flavorInfo) === JSON.stringify(line.flavorInfo ?? null));
    if (!same) changed = true;
    kept.push(same ? line : { ...line, ...source });
  }
  return { lines: kept, removed, changed };
}

/** Ítems del POST /api/sales: solo ids y cantidades (el precio lo calcula el servidor). */
export function toSaleItems(lines: readonly CartLine[]): NonNullable<CreateSaleInput['items']> {
  return lines.map((line) => ({
    itemId: line.itemId,
    ...(line.sizeId !== null ? { sizeId: line.sizeId } : {}),
    quantity: line.quantity,
    ...(line.flavors && line.flavors.length > 0 ? { flavors: line.flavors } : {}),
    ...(line.note ? { note: line.note } : {}),
  }));
}

/**
 * "12", "12.5", "12,50" → céntimos. `null` si el texto no es un monto válido
 * (vacío, letras, más de 2 decimales o sobre el tope).
 */
export function parseSolesToCents(text: string): number | null {
  const match = /^(\d{1,7})(?:[.,](\d{0,2}))?$/.exec(text.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return cents <= MAX_CENTS ? cents : null;
}

/** Céntimos → texto editable ("36.50"); sin decimales si es entero ("50"). */
export function centsToInputText(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Montos de "recibido" sugeridos: los billetes comunes que cubren el total (sin repetir el exacto). */
export function cashShortcuts(totalCents: number): number[] {
  return CASH_SHORTCUTS_CENTS.filter((amount) => amount > totalCents);
}

/** UUID v4 para `clientUuid` (idempotencia). `randomUUID` solo existe en contextos seguros; hay respaldo. */
export function newClientUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
