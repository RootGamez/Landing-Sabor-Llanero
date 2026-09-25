import { formatPrice } from "@sabor/shared";
import type { OrderDto, OrderStatus } from "@sabor/shared";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: "bg-brand-yellow/25 text-ink",
  confirmed: "bg-brand-blue/10 text-brand-blue",
  cancelled: "bg-ink/10 text-ink/70",
};

function formatOrderDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

interface OrderHistoryListProps {
  orders: OrderDto[];
}

/** Historial de pedidos propios (P2.8): nombre ya viene en español desde la API (snapshot de order_items). */
export default function OrderHistoryList({ orders }: OrderHistoryListProps) {
  if (orders.length === 0) {
    return <p className="text-sm text-ink/60">Todavía no hiciste ningún pedido.</p>;
  }

  return (
    <ul className="space-y-3">
      {orders.map((order) => (
        <li key={order.id} className="rounded-2xl border-2 border-ink/10 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-display text-lg tracking-wide text-ink">Pedido #{order.code}</p>
              <p className="text-xs text-ink/70">{formatOrderDate(order.createdAt)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGE[order.status]}`}>
              {STATUS_LABEL[order.status]}
            </span>
          </div>

          <ul className="mt-3 space-y-1 text-sm text-ink/70">
            {order.items.map((item) => (
              <li key={item.id}>
                {item.quantity}x {item.nameEs}
                {item.sizeLabel ? ` (${item.sizeLabel})` : ""}
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between border-t border-ink/10 pt-3">
            <span className="text-sm font-semibold text-ink">Subtotal</span>
            <span className="font-display text-brand-red tabular-nums">{formatPrice(order.subtotal)}</span>
          </div>
          {order.pointsAwarded != null && (
            <p className="mt-1 text-xs text-brand-blue">+{order.pointsAwarded} puntos acreditados</p>
          )}
        </li>
      ))}
    </ul>
  );
}
