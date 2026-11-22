import type { ReactNode } from 'react';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/Skeleton';
import { cn } from '../../lib/utils';

/** Estado de carga de una tarjeta (lo que devuelve `useAsync`, más si hay algo que dibujar). */
export interface CardStatus {
  loading: boolean;
  error: string | null;
  hasData: boolean;
  isEmpty: boolean;
  onRetry: () => void;
}

interface ChartCardProps {
  title: string;
  description?: string;
  /** Controles propios de la tarjeta (alternar vista, granularidad…). */
  actions?: ReactNode;
  status: CardStatus;
  emptyText: string;
  /** Alto del esqueleto: evita saltos de layout al cargar. */
  skeletonClassName?: string;
  footnote?: string | null;
  className?: string;
  children: ReactNode;
}

function CardBody({
  status,
  emptyText,
  skeletonClassName,
  children,
}: Pick<ChartCardProps, 'status' | 'emptyText' | 'skeletonClassName' | 'children'>) {
  if (status.error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 py-6">
        <p className="text-sm text-destructive">{status.error}</p>
        <button
          type="button"
          onClick={status.onRetry}
          className="min-h-11 rounded-full border border-border px-4 text-sm font-medium text-text transition-colors hover:border-primary hover:text-primary"
        >
          Reintentar
        </button>
      </div>
    );
  }
  if (status.loading && !status.hasData) {
    return <Skeleton className={cn('w-full', skeletonClassName ?? 'h-56')} />;
  }
  if (status.isEmpty) {
    return (
      <p role="status" className="py-10 text-center text-sm text-text-muted">
        {emptyText}
      </p>
    );
  }
  return <>{children}</>;
}

/** Marco común de cada gráfico: título, acciones y los tres estados (cargando, error, vacío). */
export function ChartCard({ title, description, actions, status, className, footnote, ...body }: ChartCardProps) {
  // Con datos previos y recarga en curso se atenúa en vez de reemplazar por un esqueleto (sin saltos).
  const isRefreshing = status.loading && status.hasData;
  return (
    <Card className={cn('gap-3 p-5', className)} aria-busy={status.loading}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold leading-tight text-text">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      <div className={cn('transition-opacity', isRefreshing && 'opacity-60')}>
        <CardBody {...body} status={status} />
      </div>
      {footnote && !status.error && <p className="text-xs text-text-muted">{footnote}</p>}
    </Card>
  );
}

/** Convierte el estado de `useAsync` en `CardStatus`. */
export function toCardStatus(
  state: { data: unknown; loading: boolean; error: string | null; refetch: () => void },
  isEmpty: boolean,
): CardStatus {
  return {
    loading: state.loading,
    error: state.error,
    hasData: state.data !== undefined,
    isEmpty: state.data !== undefined && isEmpty,
    onRetry: state.refetch,
  };
}
