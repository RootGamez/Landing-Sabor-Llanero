import { useState } from 'react';
import type { OrderDto, OrderStatusUpdateInput } from '@sabor/shared';
import { useMutation } from '../../hooks/useMutation';
import { api } from '../../lib/api';
import { toastSuccess } from '../../store/toastStore';
import { Button } from '../ui/Button';

type ConfirmableStatus = OrderStatusUpdateInput['status'];

interface OrderStatusActionsProps {
  order: OrderDto;
  /** Se llama tras un PATCH exitoso (confirmar o cancelar), para que el padre haga refetch. */
  onUpdated: () => void;
}

/**
 * Botones de "Confirmar"/"Cancelar" de un pedido pendiente, con su propia
 * mutación — componentizado por separado de `OrderCard` para poder usarse en
 * cualquier layout (card completa, fila de tabla, etc.) sin arrastrar el
 * resto del markup de la card. Una instancia de la mutación por pedido (no
 * un `useMutation` compartido en la lista) para que actuar sobre un pedido
 * mientras otro todavía tiene un PATCH en vuelo no le pise su estado "en
 * curso" (mismo bug ya resuelto en P2.5, ver PLAN_IMPLEMENTACION.md).
 */
export function OrderStatusActions({ order, onUpdated }: OrderStatusActionsProps) {
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
  );
}
