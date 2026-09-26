import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useOrders } from '../hooks/useCmsData';
import { OrderCard } from '../components/orders/OrderCard';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Card, CardContent } from '../components/ui/card';

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
        {loading ? (
          <Skeleton className="h-9 w-14" />
        ) : (
          <span className="font-display text-3xl font-bold text-text">{value ?? 0}</span>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Página de inicio del CMS: lo más urgente (pedidos pendientes de aceptar)
 * arriba de todo y accionable sin salir de acá — reusa `OrderCard`, mismo
 * componente que `/pedidos`. Los conteos de confirmados/cancelados piden
 * `pageSize=1` (solo necesitan el `total` de la respuesta paginada, no los
 * ítems) para no traer de más.
 */
export function DashboardPage() {
  const titleRef = useRef<HTMLHeadingElement>(null);

  const pending = useOrders({ status: 'pending', pageSize: 50 });
  const confirmed = useOrders({ status: 'confirmed', pageSize: 1 });
  const cancelled = useOrders({ status: 'cancelled', pageSize: 1 });

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 ref={titleRef} tabIndex={-1} className="font-display text-2xl font-bold text-text outline-none">
          Dashboard
        </h1>
        <p className="text-sm text-text-muted">Lo que necesita tu atención ahora mismo.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Pendientes" value={pending.data?.total} loading={pending.loading} accent />
        <StatCard label="Confirmados" value={confirmed.data?.total} loading={confirmed.loading} />
        <StatCard label="Cancelados" value={cancelled.data?.total} loading={cancelled.loading} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-text">Pedidos por aceptar</h2>
          <Link to="/pedidos" className="shrink-0 text-sm font-semibold text-primary hover:underline">
            Ver todos los pedidos
          </Link>
        </div>

        {pending.loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={`skeleton-${i}`} className="h-56 w-full rounded-xl2" />
            ))}
          </div>
        )}
        {pending.error && <ErrorState message={pending.error} onRetry={pending.refetch} />}
        {!pending.loading && !pending.error && pendingOrders.length === 0 && (
          <EmptyState
            title="No hay pedidos pendientes"
            description="Cuando entre un pedido nuevo desde la web, va a aparecer acá."
          />
        )}
        {!pending.loading && !pending.error && pendingOrders.length > 0 && (
          <>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendingOrders.map((order) => (
                <li key={order.id}>
                  <OrderCard order={order} onUpdated={handleUpdated} />
                </li>
              ))}
            </ul>
            {hiddenPendingCount > 0 && (
              <p className="mt-4 text-center text-sm text-text-muted">
                Mostrando {pendingOrders.length} de {pending.data!.total} pendientes.{' '}
                <Link to="/pedidos" className="font-semibold text-primary hover:underline">
                  Ver el resto
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
