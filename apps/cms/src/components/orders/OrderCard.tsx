import type { OrderDto, OrderStatus } from '@sabor/shared';
import { formatDateTime, formatPrice } from '../../lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
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
  /** Se llama tras un PATCH exitoso (confirmar o cancelar), para que el padre haga refetch. */
  onUpdated: () => void;
}

export function OrderCard({ order, onUpdated }: OrderCardProps) {
  return (
    <Card className={order.status === 'pending' ? 'border-primary/60' : undefined}>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="font-mono text-base tracking-wide">#{order.code}</CardTitle>
        <Badge variant={STATUS_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-text-muted">{formatDateTime(order.createdAt)}</p>

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

        {order.status === 'pending' && <OrderStatusActions order={order} onUpdated={onUpdated} />}
      </CardContent>
    </Card>
  );
}
