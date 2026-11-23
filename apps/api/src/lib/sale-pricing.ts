import {
  FlavorPricingError,
  normalizeLineNote,
  priceFlavoredLine,
  toCents,
  type FlavorPricingCatalog,
  type FlavorTarget,
  type MenuChannel,
  type OrderItemInput,
  type SaleItemFlavors,
} from '@sabor/shared';
import type { OrderItemRow, OrderRow } from '../db/rows';
import { badRequest, conflict, notFound } from './http-error';
import { buildOrderLine, loadPricingContext, type PricingContext } from '../routes/orders';
import { loadFlavorCatalog } from './flavor-catalog';

/** Canales vendibles en el mostrador (D6). */
export const POS_CHANNELS: readonly MenuChannel[] = ['both', 'pos'];

/** Línea de venta ya tasada en céntimos, lista para `sale_items` (snapshot D5). */
export interface SaleLine {
  itemId: number | null;
  sizeId: number | null;
  name: string;
  sizeLabel: string | null;
  unitPriceCents: number;
  quantity: number;
  /** Sabores tasados server-side (opcional: ventas sin sabores, pedidos web, cuentas viejas). */
  flavors?: SaleItemFlavors | null;
  /** Nota libre ya saneada. */
  note?: string | null;
}

/** Línea del carrito del POS: ids + cantidad + (opcional) sabores por pizza y nota. Nunca precios. */
export type CartLineInput = OrderItemInput & {
  flavors?: readonly (readonly number[])[];
  note?: string;
};

export function sumLines(lines: readonly SaleLine[]): number {
  return lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
}

function assertPriced(unitPriceCents: number, name: string): void {
  if (unitPriceCents <= 0) throw badRequest(`"${name}" no tiene un precio válido configurado`);
}

/**
 * Tasa el carrito del POS 100% server-side: solo se leen itemId/sizeId/
 * quantity del cliente; el precio sale de `menu_items`/`category_prices`/
 * `item_prices` con la misma lógica pura que los pedidos web. Ítems inactivos
 * o solo-web se rechazan con 400.
 */
export async function priceCartLines(db: D1Database, inputs: readonly CartLineInput[]): Promise<SaleLine[]> {
  const plainInputs = inputs.map(({ itemId, sizeId, quantity }) => ({ itemId, quantity, ...(sizeId !== undefined ? { sizeId } : {}) }));
  const needsFlavors = inputs.some((input) => input.flavors !== undefined && input.flavors.length > 0);
  const [ctx, flavorCatalog] = await Promise.all([
    loadPricingContext(db, plainInputs, POS_CHANNELS),
    needsFlavors ? loadFlavorCatalog(db, POS_CHANNELS) : Promise.resolve(null),
  ]);
  return inputs.map((input, index) => {
    const line = buildOrderLine(plainInputs[index]!, ctx);
    let unitPriceCents = toCents(line.unitPrice);
    assertPriced(unitPriceCents, line.nameEs);
    let flavors: SaleItemFlavors | null = null;
    if (flavorCatalog && input.flavors && input.flavors.length > 0) {
      const target = flavorTargetFor(input, ctx, unitPriceCents, line.nameEs);
      const priced = priceWithFlavors(target, input.flavors, flavorCatalog, line.nameEs);
      unitPriceCents = priced.unitPriceCents;
      flavors = { kind: target.kind, pizzas: priced.pizzas };
    }
    return {
      itemId: line.itemId,
      sizeId: input.sizeId ?? null,
      name: line.nameEs,
      sizeLabel: line.sizeLabel,
      unitPriceCents,
      quantity: line.quantity,
      flavors,
      note: normalizeLineNote(input.note),
    };
  });
}

/**
 * Decide cómo se tasa una línea con sabores según el ítem: pizza por tamaño
 * (categoría con tamaños) o promo configurada con N pizzas de un tamaño. Lo
 * demás no admite sabores.
 */
function flavorTargetFor(input: CartLineInput, ctx: PricingContext, basePriceCents: number, name: string): FlavorTarget {
  const item = ctx.itemById.get(input.itemId);
  const category = item ? ctx.categoryById.get(item.category_id) : undefined;
  if (!item || !category) throw badRequest(`"${name}" no está disponible`);
  if (category.has_sizes === 1) {
    if (input.sizeId === undefined) throw badRequest(`"${name}" requiere tamaño`);
    return { kind: 'pizza', itemId: item.id, sizeId: input.sizeId };
  }
  const pizzaCount = item.promo_pizza_count ?? null;
  const sizeId = item.promo_pizza_size_id ?? null;
  if (pizzaCount === null || sizeId === null) throw badRequest(`"${name}" no admite sabores`);
  return { kind: 'promo', itemId: item.id, basePriceCents, pizzaCount, sizeId };
}

function priceWithFlavors(
  target: FlavorTarget,
  selection: readonly (readonly number[])[],
  catalog: FlavorPricingCatalog,
  name: string,
) {
  try {
    return priceFlavoredLine(target, selection, catalog);
  } catch (err) {
    if (err instanceof FlavorPricingError) throw badRequest(`${name}: ${err.message}`);
    throw err;
  }
}

/**
 * Líneas de un pedido web para "Cobrar pedido web" (D7): el pedido debe ser
 * un `storefront` confirmado y no cobrado antes; precios y cantidades salen
 * de su snapshot de `order_items`, nunca del cliente.
 */
export async function linesFromOrder(db: D1Database, orderId: number): Promise<SaleLine[]> {
  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<OrderRow>();
  if (!order) throw notFound('Pedido no encontrado');
  if (order.source !== 'storefront') throw badRequest('Los pedidos de canje de premio no se cobran en caja');
  if (order.status !== 'confirmed') throw conflict(`El pedido está en estado '${order.status}': solo se cobran pedidos confirmados`);
  const charged = await db.prepare('SELECT id FROM sales WHERE order_id = ?').bind(orderId).first();
  if (charged) throw conflict('Ese pedido ya fue cobrado');

  const { results } = await db
    .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC')
    .bind(orderId)
    .all<OrderItemRow>();
  if (results.length === 0) throw badRequest('El pedido no tiene ítems');
  return results.map((row) => {
    const unitPriceCents = toCents(row.unit_price);
    assertPriced(unitPriceCents, row.name_es);
    return {
      itemId: row.item_id,
      sizeId: null,
      name: row.name_es,
      sizeLabel: row.size_label,
      unitPriceCents,
      quantity: row.quantity,
    };
  });
}
