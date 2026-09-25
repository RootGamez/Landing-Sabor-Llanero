import { useState } from 'react';
import type { OrderDto, OrderStatus, OrderStatusUpdateInput } from '@sabor/shared';
import { useMutation } from '../../hooks/useMutation';
import { api } from '../../lib/api';
import { toastSuccess } from '../../store/toastStore';
import { formatDateTime, formatPrice } from '../../lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/Button';

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

type ConfirmableStatus = OrderStatusUpdateInput['status'];

interface OrderCardProps {
  order: OrderDto;
  /** Se llama tras un PATCH exitoso (confirmar o cancelar), para que el padre haga refetch. */
  onUpdated: () => void;
}

/**
 * La mutación de confirmar/cancelar vive ACÁ, una por card, en vez de un
 * único `useMutation` compartido en la página con un `actingOnId`: con un
 * solo estado compartido, actuar sobre el pedido B mientras A todavía tiene
 * un PATCH en vuelo pisaba el id "en curso" de A, reactivando sus botones
 * antes de que su request realmente terminara (podía habilitar un doble
 * submit sobre el mismo pedido). Un `useMutation` por card lo evita del todo.
 */
export function OrderCard({ order, onUpdated }: OrderCardProps) {
  const { mutate: updateStatus, loading } = useMutation((status: ConfirmableStatus) =>
    api.patch(`/orders/${order.id}`, { status }),
  );
  const [pendingAction, setPendingAction] = useState<ConfirmableStatus | null>(null);

  async function handleUpdate(next: ConfirmableStatus) {
    const question =
      next === 'confirmed'
        ? `¿Confirmar el pedido #${order.code}? Se acreditan los puntos y la entrada al sorteo.`
        : `¿Cancelar el pedido #${order.code}? Esta acción no se puede deshacer.`;
    if (!window.confirm(question)) return;

    setPendingAction(next);
    const res = await updateStatus(next);
    setPendingAction(null);
    if (res !== undefined) {
      toastSuccess(next === 'confirmed' ? 'Pedido confirmado' : 'Pedido cancelado');
      onUpdated();
    }
  }

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

        {order.status === 'pending' && (
          <div className="flex gap-2 pt-1">
            <Button
              variant="primary"
              size="sm"
              loading={loading && pendingAction === 'confirmed'}
              disabled={loading}
              onClick={() => handleUpdate('confirmed')}
              className="flex-1"
            >
              Confirmar
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={loading && pendingAction === 'cancelled'}
              disabled={loading}
              onClick={() => handleUpdate('cancelled')}
              className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              Cancelar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
