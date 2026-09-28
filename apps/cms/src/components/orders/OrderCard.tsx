import type { OrderDto, OrderStatus, Size } from '@sabor/shared';
import type { CategoryWithPrices } from '../../lib/adminTypes';
import { formatDateTime, formatPrice } from '../../lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { EditOrderItemsDialog } from './EditOrderItemsDialog';
import { OrderStatusActions } from './OrderStatusActions';

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
};

const STATUS_VARIANT: Record<OrderStatus, 'accent' | 'success' | 'muted'> = {
  pending: 'accent',
  confirmed: 'success',
  cancelled: 'muted',
};

interface OrderCardProps {
  order: OrderDto;
  /** Cargados una sola vez en `PedidosPage`, para el editor de ítems (P2.9). */
  categories: CategoryWithPrices[] | undefined;
  sizes: Size[] | undefined;
  /** Se llama tras un PATCH/PUT exitoso (confirmar, cancelar o editar ítems), para que el padre haga refetch. */
  onUpdated: () => void;
}

export function OrderCard({ order, categories, sizes, onUpdated }: OrderCardProps) {
  return (
    <Card className={order.status === 'pending' ? 'border-primary/60' : undefined}>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="font-mono text-base tracking-wide">#{order.code}</CardTitle>
        <div className="flex items-center gap-2">
          {order.source === 'reward_redemption' && <Badge variant="sky">Premio</Badge>}
          <Badge variant={STATUS_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-text-muted">{formatDateTime(order.createdAt)}</p>

        <p className="text-sm text-text">
          {order.customerName ?? 'Cliente eliminado'}
          {order.customerPhone && <span className="text-text-muted"> · {order.customerPhone}</span>}
        </p>

        <ul className="flex flex-col gap-1 text-sm text-text">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2">
              <span>
                {item.quantity}× {item.nameEs}
                {item.sizeLabel && <span className="text-text-muted"> ({item.sizeLabel})</span>}
              </span>
              <span className="tabular-nums text-text-muted">{formatPrice(item.unitPrice * item.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-sm font-bold text-text">Subtotal</span>
          <span className="tabular-nums text-sm font-bold text-text">{formatPrice(order.subtotal)}</span>
        </div>

        {order.status === 'confirmed' && order.pointsAwarded !== null && (
          <p className="text-xs text-text-muted">Puntos otorgados: {order.pointsAwarded}</p>
        )}

        {order.status === 'pending' && (
          <div className="flex flex-col gap-2">
            {/* Los pedidos de canje de premio no se editan: están atados a los puntos ya gastados. */}
            {order.source === 'storefront' && (
              <EditOrderItemsDialog order={order} categories={categories} sizes={sizes} onUpdated={onUpdated} />
            )}
            <OrderStatusActions order={order} onUpdated={onUpdated} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
