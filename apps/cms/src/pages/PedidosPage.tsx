import { useRef, useState } from 'react';
import type { OrderStatus } from '@sabor/shared';
import { useOrders } from '../hooks/useCmsData';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { OrderCard } from '../components/orders/OrderCard';

type StatusFilter = OrderStatus | 'all';

const TABS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'cancelled', label: 'Cancelados' },
  { value: 'all', label: 'Todos' },
];

export function PedidosPage() {
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [page, setPage] = useState(1);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const { data: result, loading, error, refetch } = useOrders({
    status: status === 'all' ? undefined : status,
    page,
  });

  function handleUpdated() {
    refetch();
    // La card que acaba de actuar puede salir de la lista (ej. sale de
    // "Pendientes" al confirmar) y se lleva el foco con ella; sin esto cae a
    // <body> y un usuario de teclado/lector de pantalla pierde su lugar.
    titleRef.current?.focus();
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 ref={titleRef} tabIndex={-1} className="font-display text-2xl font-bold text-text outline-none">
          Pedidos
        </h1>
        <p className="text-sm text-text-muted">Confirmá o cancelá los pedidos que coordinás por WhatsApp.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <FilterChip
            key={tab.value}
            label={tab.label}
            active={status === tab.value}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
          />
        ))}
      </div>

      <div>
        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={`skeleton-${i}`} className="h-56 w-full rounded-xl2" />
            ))}
          </div>
        )}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {!loading && !error && result && result.items.length === 0 && (
          <EmptyState
            title="No hay pedidos"
            description="Los pedidos nuevos de la web van a aparecer acá."
          />
        )}
        {!loading && !error && result && result.items.length > 0 && (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((order) => (
              <li key={order.id}>
                <OrderCard order={order} onUpdated={handleUpdated} />
              </li>
            ))}
          </ul>
        )}

        {result && result.total > result.pageSize && (
          <div className="mt-6 flex items-center justify-center gap-4">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span className="text-sm text-text-muted">
              Página {result.page} de {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border-2 px-4 py-1.5 text-sm font-bold font-display uppercase tracking-wide transition-all active:scale-95',
        active
          ? 'border-forest bg-primary text-primary-foreground shadow-sticker-lime'
          : 'border-border bg-surface text-text hover:border-forest'
      )}
    >
      {label}
    </button>
  );
}
