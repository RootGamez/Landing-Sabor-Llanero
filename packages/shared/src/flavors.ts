/**
 * Sabores y notas por línea del POS (pizza de 2 sabores, promos con pizzas a
 * elegir). Lógica PURA y compartida: la API la usa para tasar y validar al
 * registrar la venta (fuente de verdad) y el CMS para mostrar el precio en vivo
 * sin depender de la red. Todo en céntimos enteros (D1).
 *
 * Reglas (ver docs/SABORES_Y_NOTAS.md):
 *  - Pizza individual con varios sabores: se cobra el precio del sabor MÁS
 *    CARO en el MISMO tamaño de la línea.
 *  - Promo: precio normal de la promo + por cada pizza incluida un adicional =
 *    precio de lista de la categoría del sabor − precio de lista de Clásicas,
 *    ambos en el tamaño de la promo. Nunca negativo. Si la pizza lleva 2
 *    sabores se toma el adicional MAYOR entre sus sabores (el de la categoría
 *    del sabor más caro con la carta actual; conservador si hay overrides).
 */
import { toCents } from './money';
import { UNSAFE_TEXT } from './validation';

/** Máximo de sabores por pizza (pizza individual y cada pizza de una promo). */
export const MAX_FLAVORS_PER_PIZZA = 2;
/** Tope sanitario de pizzas configurables en una promo. */
export const MAX_PROMO_PIZZAS = 6;
/** Largo máximo de la nota libre de una línea. */
export const LINE_NOTE_MAX = 200;
/** Slug de la categoría base contra la que se calcula el adicional de las promos. */
export const BASE_PIZZA_CATEGORY_SLUG = 'clasicas';

/** Un sabor elegible: pizza activa (categoría con tamaños) con su precio resuelto por tamaño. */
export interface FlavorItem {
  itemId: number;
  name: string;
  categoryId: number;
  /** sizeId → céntimos (override del ítem o herencia de la categoría). */
  priceCentsBySize: Readonly<Record<number, number>>;
}

/** Categoría de pizzas con su precio de LISTA por tamaño (category_prices). */
export interface FlavorCategoryInfo {
  id: number;
  name: string;
  listPriceCentsBySize: Readonly<Record<number, number>>;
}

export interface FlavorPricingCatalog {
  flavors: ReadonlyMap<number, FlavorItem>;
  categories: ReadonlyMap<number, FlavorCategoryInfo>;
  /** Categoría Clásicas; null si no existe (no se pueden tasar adicionales de promo). */
  baseCategoryId: number | null;
}

/** Qué se está tasando: una pizza vendida por tamaño o una promo con N pizzas de un tamaño. */
export type FlavorTarget =
  | { kind: 'pizza'; itemId: number; sizeId: number }
  | { kind: 'promo'; itemId: number; basePriceCents: number; pizzaCount: number; sizeId: number };

export interface PizzaFlavorRef {
  itemId: number;
  name: string;
}

export interface PricedPizza {
  flavors: PizzaFlavorRef[];
  /** Sabor que fija el precio (el más caro en ese tamaño). */
  pricedBy: PizzaFlavorRef;
  /** Categoría que explica el precio/adicional. */
  categoryName: string;
  /** Adicional por categoría (solo promos; 0 en pizza individual). */
  surchargeCents: number;
}

export interface FlavorPriceResult {
  unitPriceCents: number;
  pizzas: PricedPizza[];
}

/** Snapshot que se guarda por línea vendida (`sale_items.flavors_json`). */
export interface SaleItemFlavors {
  kind: 'pizza' | 'promo';
  pizzas: PricedPizza[];
}

export type FlavorErrorCode =
  | 'unknown_flavor'
  | 'no_price_for_size'
  | 'too_many_flavors'
  | 'empty_pizza'
  | 'duplicate_flavor'
  | 'wrong_pizza_count'
  | 'must_include_item'
  | 'base_missing';

export class FlavorPricingError extends Error {
  readonly code: FlavorErrorCode;

  constructor(code: FlavorErrorCode, message: string) {
    super(message);
    this.name = 'FlavorPricingError';
    this.code = code;
  }
}

interface ResolvedFlavor {
  item: FlavorItem;
  priceCents: number;
}

function resolveFlavors(ids: readonly number[], sizeId: number, catalog: FlavorPricingCatalog, label: string): ResolvedFlavor[] {
  if (ids.length === 0) throw new FlavorPricingError('empty_pizza', `${label}: elige al menos un sabor`);
  if (ids.length > MAX_FLAVORS_PER_PIZZA) {
    throw new FlavorPricingError('too_many_flavors', `${label}: máximo ${MAX_FLAVORS_PER_PIZZA} sabores por pizza`);
  }
  if (new Set(ids).size !== ids.length) throw new FlavorPricingError('duplicate_flavor', `${label}: hay un sabor repetido`);
  return ids.map((id) => {
    const item = catalog.flavors.get(id);
    if (!item) throw new FlavorPricingError('unknown_flavor', `${label}: el sabor ${id} no existe o no está disponible`);
    const priceCents = item.priceCentsBySize[sizeId];
    if (priceCents === undefined || priceCents <= 0) {
      throw new FlavorPricingError('no_price_for_size', `${label}: ${item.name} no tiene precio en ese tamaño`);
    }
    return { item, priceCents };
  });
}

/** El más caro; en empate gana el primero elegido (orden estable). */
function mostExpensive(flavors: readonly ResolvedFlavor[]): ResolvedFlavor {
  return flavors.reduce((best, current) => (current.priceCents > best.priceCents ? current : best));
}

function toRef(item: FlavorItem): PizzaFlavorRef {
  return { itemId: item.itemId, name: item.name };
}

function categoryName(catalog: FlavorPricingCatalog, categoryId: number): string {
  return catalog.categories.get(categoryId)?.name ?? '';
}

/** Adicional de una categoría sobre Clásicas en un tamaño (≥ 0). */
function categorySurcharge(catalog: FlavorPricingCatalog, categoryId: number, sizeId: number, label: string): number {
  const base = catalog.baseCategoryId === null ? undefined : catalog.categories.get(catalog.baseCategoryId);
  const basePrice = base?.listPriceCentsBySize[sizeId];
  if (basePrice === undefined) {
    throw new FlavorPricingError('base_missing', 'Falta el precio de Pizzas Clásicas para ese tamaño: no se puede calcular el adicional');
  }
  const own = catalog.categories.get(categoryId)?.listPriceCentsBySize[sizeId];
  if (own === undefined) throw new FlavorPricingError('no_price_for_size', `${label}: la categoría no tiene precio en ese tamaño`);
  return Math.max(0, own - basePrice);
}

function pricePromoPizza(ids: readonly number[], sizeId: number, catalog: FlavorPricingCatalog, label: string): PricedPizza {
  const flavors = resolveFlavors(ids, sizeId, catalog, label);
  const top = mostExpensive(flavors);
  // Adicional MAYOR entre los sabores: con la carta actual coincide con la categoría del más caro.
  let surcharge = { cents: -1, categoryId: top.item.categoryId };
  for (const flavor of flavors) {
    const cents = categorySurcharge(catalog, flavor.item.categoryId, sizeId, label);
    if (cents > surcharge.cents) surcharge = { cents, categoryId: flavor.item.categoryId };
  }
  return {
    flavors: flavors.map((f) => toRef(f.item)),
    pricedBy: toRef(top.item),
    categoryName: categoryName(catalog, surcharge.categoryId),
    surchargeCents: surcharge.cents,
  };
}

/**
 * Tasa una línea con sabores. `selection` = una lista de sabores (itemIds) por
 * pizza. Lanza `FlavorPricingError` si la selección no es válida.
 */
export function priceFlavoredLine(
  target: FlavorTarget,
  selection: readonly (readonly number[])[],
  catalog: FlavorPricingCatalog,
): FlavorPriceResult {
  if (target.kind === 'pizza') {
    const [only] = selection;
    if (selection.length !== 1 || !only) throw new FlavorPricingError('wrong_pizza_count', 'Una pizza lleva una sola lista de sabores');
    const flavors = resolveFlavors(only, target.sizeId, catalog, 'Pizza');
    if (!only.includes(target.itemId)) {
      throw new FlavorPricingError('must_include_item', 'La pizza del ticket debe ser uno de sus sabores');
    }
    const top = mostExpensive(flavors);
    return {
      unitPriceCents: top.priceCents,
      pizzas: [
        {
          flavors: flavors.map((f) => toRef(f.item)),
          pricedBy: toRef(top.item),
          categoryName: categoryName(catalog, top.item.categoryId),
          surchargeCents: 0,
        },
      ],
    };
  }

  if (selection.length !== target.pizzaCount) {
    throw new FlavorPricingError('wrong_pizza_count', `Esta promo incluye ${target.pizzaCount} pizza(s): elige los sabores de cada una`);
  }
  const pizzas = selection.map((ids, index) => pricePromoPizza(ids, target.sizeId, catalog, `Pizza ${index + 1}`));
  const surcharges = pizzas.reduce((sum, pizza) => sum + pizza.surchargeCents, 0);
  return { unitPriceCents: target.basePriceCents + surcharges, pizzas };
}

// ── Catálogo de sabores (mismo armado en API y CMS) ─────────────────────────

/** Categoría tal como la conocen API (filas) y CMS (DTO): precios de lista en soles. */
export interface FlavorSourceCategory {
  id: number;
  slug: string;
  name: string;
  hasSizes: boolean;
  listPrices: readonly { sizeId: number; price: number }[];
}

/** Ítem activo y vendible en el canal, con sus precios YA resueltos por tamaño (soles). */
export interface FlavorSourceItem {
  id: number;
  name: string;
  categoryId: number;
  prices: readonly { sizeId: number; price: number }[];
}

function centsBySize(prices: readonly { sizeId: number; price: number }[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const { sizeId, price } of prices) {
    if (!Number.isFinite(price) || price <= 0) continue;
    try {
      out[sizeId] = toCents(price);
    } catch {
      /* precio fuera de rango: ese tamaño queda sin precio y la validación lo rechaza */
    }
  }
  return out;
}

/** Arma el catálogo de sabores: solo pizzas (categorías con tamaños). Clásicas se ubica por slug. */
export function buildFlavorCatalog(
  categories: readonly FlavorSourceCategory[],
  items: readonly FlavorSourceItem[],
): FlavorPricingCatalog {
  const pizzaCategories = categories.filter((category) => category.hasSizes);
  const categoryMap = new Map<number, FlavorCategoryInfo>(
    pizzaCategories.map((category) => [
      category.id,
      { id: category.id, name: category.name, listPriceCentsBySize: centsBySize(category.listPrices) },
    ]),
  );
  const flavors = new Map<number, FlavorItem>();
  for (const item of items) {
    if (!categoryMap.has(item.categoryId)) continue;
    flavors.set(item.id, { itemId: item.id, name: item.name, categoryId: item.categoryId, priceCentsBySize: centsBySize(item.prices) });
  }
  const base = pizzaCategories.find((category) => category.slug === BASE_PIZZA_CATEGORY_SLUG);
  return { flavors, categories: categoryMap, baseCategoryId: base?.id ?? null };
}

// ── Notas ───────────────────────────────────────────────────────────────────

const UNSAFE_TEXT_GLOBAL = new RegExp(UNSAFE_TEXT.source, 'g');

/** Nota libre de una línea: sin control/bidi, espacios colapsados, recortada al máximo. Vacía → null. */
export function normalizeLineNote(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(UNSAFE_TEXT_GLOBAL, ' ').replace(/\s+/g, ' ').trim().slice(0, LINE_NOTE_MAX).trim();
  return clean.length > 0 ? clean : null;
}

// ── Identidad de línea ──────────────────────────────────────────────────────

/**
 * Clave de una línea del ticket: mismo producto + tamaño + sabores + nota
 * suman cantidad; cualquier diferencia es otra línea. Sin sabores ni nota es
 * idéntica a la clave histórica `itemId:sizeId` (compatibilidad con carritos
 * guardados).
 */
export function cartLineIdentity(
  itemId: number,
  sizeId: number | null,
  flavors: readonly (readonly number[])[] | null,
  note: string | null,
): string {
  const base = `${itemId}:${sizeId ?? 0}`;
  const flavorPart = flavors && flavors.length > 0 ? `|f=${flavors.map((pizza) => pizza.join('+')).join(',')}` : '';
  const notePart = note ? `|n=${encodeURIComponent(note)}` : '';
  return `${base}${flavorPart}${notePart}`;
}

// ── Snapshot guardado ───────────────────────────────────────────────────────

function isRef(value: unknown): value is PizzaFlavorRef {
  if (typeof value !== 'object' || value === null) return false;
  const ref = value as Record<string, unknown>;
  return Number.isInteger(ref.itemId) && typeof ref.name === 'string';
}

function isPricedPizza(value: unknown): value is PricedPizza {
  if (typeof value !== 'object' || value === null) return false;
  const pizza = value as Record<string, unknown>;
  return (
    Array.isArray(pizza.flavors) &&
    pizza.flavors.length > 0 &&
    pizza.flavors.every(isRef) &&
    isRef(pizza.pricedBy) &&
    typeof pizza.categoryName === 'string' &&
    Number.isInteger(pizza.surchargeCents) &&
    (pizza.surchargeCents as number) >= 0
  );
}

/** Lee `flavors_json` de forma defensiva: JSON roto o con forma inesperada → null (no rompe el historial). */
export function parseSaleItemFlavors(json: string | null | undefined): SaleItemFlavors | null {
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const snapshot = parsed as Record<string, unknown>;
  if (snapshot.kind !== 'pizza' && snapshot.kind !== 'promo') return null;
  if (!Array.isArray(snapshot.pizzas) || snapshot.pizzas.length === 0 || !snapshot.pizzas.every(isPricedPizza)) return null;
  return { kind: snapshot.kind, pizzas: snapshot.pizzas };
}

/** Selección (itemIds por pizza) a partir del snapshot guardado: para re-identificar una línea. */
export function flavorIdsOf(snapshot: SaleItemFlavors | null | undefined): number[][] | null {
  if (!snapshot) return null;
  return snapshot.pizzas.map((pizza) => pizza.flavors.map((flavor) => flavor.itemId));
}

// ── Ticket ──────────────────────────────────────────────────────────────────

/** Ancho en caracteres de una línea de ticket térmico (fuente estándar). */
export const TICKET_WIDTH_58MM = 32;
export const TICKET_WIDTH_80MM = 48;

/** "S/ 8.00" con espacio normal (estable para impresoras térmicas, sin depender de Intl). */
function ticketMoney(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

export interface TicketDetailInput {
  flavors: SaleItemFlavors | null;
  note: string | null;
  quantity: number;
}

/**
 * Líneas de detalle bajo un ítem del ticket (texto plano: quien lo pinte debe
 * escaparlo o usar nodos de texto). Ejemplo de promo:
 *   Pizza 1: Hawaiana / Llanera
 *   Adicional Pizzas de la Casa +S/ 8.00
 *   Pizza 2: Pepperoni
 *   Nota: sin cebolla
 */
export function ticketDetailLines(input: TicketDetailInput): string[] {
  const out: string[] = [];
  const perUnit = input.quantity > 1 ? ' c/u' : '';
  const { flavors } = input;
  if (flavors?.kind === 'pizza') {
    const [pizza] = flavors.pizzas;
    if (pizza && pizza.flavors.length > 1) {
      out.push(`Sabores: ${pizza.flavors.map((f) => f.name).join(' / ')}`);
      out.push(`Precio de ${pizza.pricedBy.name}`);
    }
  } else if (flavors?.kind === 'promo') {
    flavors.pizzas.forEach((pizza, index) => {
      out.push(`Pizza ${index + 1}: ${pizza.flavors.map((f) => f.name).join(' / ')}`);
      if (pizza.surchargeCents > 0) {
        out.push(`Adicional ${pizza.categoryName} +${ticketMoney(pizza.surchargeCents)}${perUnit}`);
      }
    });
  }
  if (input.note) out.push(`Nota: ${input.note}`);
  return out;
}

/** Parte un texto en renglones de `width` caracteres (sangría incluida), por palabras. */
export function wrapTicketText(text: string, width: number, indent = 0): string[] {
  const pad = ' '.repeat(indent);
  const room = Math.max(1, width - indent);
  const rows: string[] = [];
  let current = '';
  for (const rawWord of text.split(/\s+/).filter(Boolean)) {
    let word = rawWord;
    while (word.length > room) {
      if (current) {
        rows.push(current);
        current = '';
      }
      rows.push(word.slice(0, room));
      word = word.slice(room);
    }
    if (!word) continue;
    if (!current) current = word;
    else if (current.length + 1 + word.length <= room) current = `${current} ${word}`;
    else {
      rows.push(current);
      current = word;
    }
  }
  if (current) rows.push(current);
  return rows.map((row) => `${pad}${row}`);
}
