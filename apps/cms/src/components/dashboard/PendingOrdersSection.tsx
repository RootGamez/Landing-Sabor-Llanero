import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCategories, useOrders, useSizes } from '../../hooks/useCmsData';
import { OrderCard } from '../orders/OrderCard';
import { Skeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';
import { Card, CardContent } from '../ui/card';

function StatCard({
  label,
  value,
  loading,
  accent,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? 'border-primary/60' : undefined}>
      <CardContent className="gap-1 py-4">
        <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{label}</span>
        {loading && value === undefined ? (
          <Skeleton className="h-9 w-14" />
        ) : (
          <span className="font-display text-3xl font-bold text-text">{value ?? '—'}</span>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Pedidos web por aceptar (lo más urgente de la tienda online), accionables sin
 * salir del inicio: reusa `OrderCard`, mismo componente que `/tienda/pedidos`.
 * Los conteos de confirmados/cancelados piden `pageSize=1` (solo necesitan el
 * `total` de la respuesta paginada).
 */
export function PendingOrdersSection() {
  const titleRef = useRef<HTMLHeadingElement>(null);

  const pending = useOrders({ status: 'pending', pageSize: 50 });
  const confirmed = useOrders({ status: 'confirmed', pageSize: 1 });
  const cancelled = useOrders({ status: 'cancelled', pageSize: 1 });
  // Para el editor de ítems de P2.9 (mismo criterio que PedidosPage: una sola carga aquí, no por card).
  const { data: categories } = useCategories();
  const { data: sizes } = useSizes();

  function handleUpdated() {
    pending.refetch();
    confirmed.refetch();
    // La card que acaba de actuar sale de la lista de pendientes y se lleva
    // el foco con ella (mismo bug que en PedidosPage sin esto).
    titleRef.current?.focus();
  }

  const pendingOrders = pending.data?.items ?? [];
  const hiddenPendingCount = pending.data ? pending.data.total - pendingOrders.length : 0;

  return (
    <section aria-labelledby="pending-orders-title" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2
          id="pending-orders-title"
          ref={titleRef}
          tabIndex={-1}
          className="font-display text-lg font-bold text-text outline-none"
        >
          Pedidos web por aceptar
        </h2>
        <Link to="/tienda/pedidos" className="shrink-0 text-sm font-semibold text-primary hover:underline">
          Ver todos los pedidos
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Pendientes" value={pending.data?.total} loading={pending.loading} accent />
        <StatCard label="Confirmados" value={confirmed.data?.total} loading={confirmed.loading} />
        <StatCard label="Cancelados" value={cancelled.data?.total} loading={cancelled.loading} />
      </div>

      {pending.loading && !pending.data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-56 w-full rounded-xl2" />
          ))}
        </div>
      )}
      {pending.error && <ErrorState message={pending.error} onRetry={pending.refetch} />}
      {pending.data && !pending.error && pendingOrders.length === 0 && (
        <EmptyState
          title="No hay pedidos pendientes"
          description="Cuando entre un pedido nuevo desde la web, va a aparecer aquí."
        />
      )}
      {pending.data && !pending.error && pendingOrders.length > 0 && (
        <>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendingOrders.map((order) => (
              <li key={order.id}>
                <OrderCard order={order} categories={categories} sizes={sizes} onUpdated={handleUpdated} />
              </li>
            ))}
          </ul>
          {hiddenPendingCount > 0 && (
            <p className="text-center text-sm text-text-muted">
              Mostrando {pendingOrders.length} de {pending.data!.total} pendientes.{' '}
              <Link to="/tienda/pedidos" className="font-semibold text-primary hover:underline">
                Ver el resto
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
