import { toCents, type MenuChannel, type OrderItemInput } from '@sabor/shared';
import type { OrderItemRow, OrderRow } from '../db/rows';
import { badRequest, conflict, notFound } from './http-error';
import { buildOrderLine, loadPricingContext } from '../routes/orders';

/** Canales vendibles en el mostrador (D6). */
const POS_CHANNELS: readonly MenuChannel[] = ['both', 'pos'];

/** Línea de venta ya tasada en céntimos, lista para `sale_items` (snapshot D5). */
export interface SaleLine {
  itemId: number | null;
  sizeId: number | null;
  name: string;
  sizeLabel: string | null;
  unitPriceCents: number;
  quantity: number;
}

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
export async function priceCartLines(db: D1Database, inputs: OrderItemInput[]): Promise<SaleLine[]> {
  const ctx = await loadPricingContext(db, inputs, POS_CHANNELS);
  return inputs.map((input) => {
    const line = buildOrderLine(input, ctx);
    const unitPriceCents = toCents(line.unitPrice);
    assertPriced(unitPriceCents, line.nameEs);
    return {
      itemId: line.itemId,
      sizeId: input.sizeId ?? null,
      name: line.nameEs,
      sizeLabel: line.sizeLabel,
      unitPriceCents,
      quantity: line.quantity,
    };
  });
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
