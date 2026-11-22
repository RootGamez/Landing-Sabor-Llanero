import { formatPEN, type PendingWebOrder } from '@sabor/shared';
import type { AsyncState } from '../../hooks/useAsync';
import { formatClock } from '../../lib/posFormat';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { PosModal } from './PosModal';

type PendingState = AsyncState<PendingWebOrder[]> & { refetch: () => void };

interface PendingOrdersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: PendingState;
  onCharge: (order: PendingWebOrder) => void;
}

function OrderRow({ order, onCharge }: { order: PendingWebOrder; onCharge: (order: PendingWebOrder) => void }) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border-2 border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-base font-bold tracking-wide text-text">#{order.code}</p>
          <p className="truncate text-sm text-text-muted">
            {order.customerName ?? 'Cliente'} · confirmado {order.confirmedAt ? formatClock(order.confirmedAt) : ''}
          </p>
        </div>
        <p className="text-lg font-extrabold tabular-nums text-text">{formatPEN(order.totalCents)}</p>
      </div>
      <ul className="text-sm text-text">
        {order.items.map((item) => (
          <li key={item.id}>
            {item.quantity}× {item.nameEs}
            {item.sizeLabel && <span className="text-text-muted"> ({item.sizeLabel})</span>}
          </li>
        ))}
      </ul>
      <Button className="h-12 w-full" onClick={() => onCharge(order)}>
        Cobrar pedido #{order.code}
      </Button>
    </li>
  );
}

function OrdersBody({ state, onCharge }: Pick<PendingOrdersSheetProps, 'state' | 'onCharge'>) {
  if (state.error && !state.data) return <ErrorState message={state.error} onRetry={state.refetch} />;
  if (!state.data) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }
  if (state.data.length === 0) {
    return (
      <EmptyState
        title="No hay pedidos web por cobrar"
        description="Los pedidos confirmados en los últimos 7 días aparecen aquí."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {state.data.map((order) => (
        <OrderRow key={order.id} order={order} onCharge={onCharge} />
      ))}
    </ul>
  );
}

/** "Cobrar pedido web" (D7): los pedidos confirmados de la tienda que aún no pasaron por caja. */
export function PendingOrdersSheet({ open, onOpenChange, state, onCharge }: PendingOrdersSheetProps) {
  return (
    <PosModal
      open={open}
      onOpenChange={onOpenChange}
      placement="right"
      title="Pedidos web por cobrar"
      description="Cobra el pedido al entregarlo para que cuente en la caja."
    >
      <OrdersBody state={state} onCharge={onCharge} />
    </PosModal>
  );
}
