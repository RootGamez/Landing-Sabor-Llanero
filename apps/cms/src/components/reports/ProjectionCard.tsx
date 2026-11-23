import { Info, TrendingUp } from 'lucide-react';
import { formatPEN, type MonthProjection } from '@sabor/shared';
import { cn } from '../../lib/utils';
import { formatDeltaPct } from '../../lib/dashboardFormat';
import type { MonthProjectionState } from '../../hooks/useMonthProjection';
import { ChartCard, toCardStatus } from '../dashboard/ChartCard';

const METHOD_TEXT = {
  weekday:
    'Toma lo vendido cada día de la semana en lo que va del mes (los sábados no venden igual que los lunes) y lo repite en los días que faltan.',
  average: 'Toma el promedio diario de lo que va del mes y lo repite en los días que faltan.',
} as const;

function vsLastMonth(projectedCents: number, lastMonthCents: number | undefined): string | null {
  if (lastMonthCents === undefined) return null;
  if (lastMonthCents === 0) return `vs. ${formatPEN(0)} el mes pasado`;
  const pct = Math.round(((projectedCents - lastMonthCents) / lastMonthCents) * 1000) / 10;
  return `vs. ${formatPEN(lastMonthCents)} el mes pasado (${formatDeltaPct(pct)})`;
}

function HowItWorks({ method }: { method: 'weekday' | 'average' }) {
  return (
    <details className="group text-xs text-text-muted">
      <summary className="flex min-h-11 cursor-pointer items-center gap-1.5 font-semibold text-text">
        <Info aria-hidden="true" className="size-4" />
        ¿Cómo se calcula?
      </summary>
      <div className="flex flex-col gap-1 pb-1">
        <p>
          Es una estimación de ingresos con los días completos del mes (sin contar hoy, que está a medias). {METHOD_TEXT[method]}
        </p>
        <p>
          El rango suma y resta la variación normal de tus ventas diarias; nunca baja de lo que ya vendiste. No
          considera feriados, promociones ni cambios de precio.
        </p>
      </div>
    </details>
  );
}

function ProjectionBody({ projection, lastMonthCents }: { projection: MonthProjection; lastMonthCents: number | undefined }) {
  if (projection.status === 'insufficient') {
    return (
      <p role="status" className="py-4 text-sm text-text-muted">
        Datos insuficientes: se necesitan al menos {projection.minDays} días completos de ventas en el mes y hay{' '}
        {projection.observedDays}. La proyección aparecerá en cuanto haya más días.
      </p>
    );
  }
  const comparison = vsLastMonth(projection.projectedCents, lastMonthCents);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Proyección al cierre del mes</p>
      <p className="font-display text-3xl font-bold tabular-nums text-text">{formatPEN(projection.projectedCents)}</p>
      {comparison && <p className="text-sm text-text">{comparison}</p>}
      <p className="text-sm text-text-muted">
        Rango probable: {formatPEN(projection.lowCents)} a {formatPEN(projection.highCents)}. Llevas{' '}
        {formatPEN(projection.actualCents)} y faltan {projection.remainingDays}{' '}
        {projection.remainingDays === 1 ? 'día' : 'días'}.
      </p>
      <HowItWorks method={projection.method} />
    </div>
  );
}

interface ProjectionCardProps {
  state: MonthProjectionState;
  className?: string;
}

/** Tarjeta "Proyección al cierre del mes" (solo cuando el rango es el mes en curso). */
export function ProjectionCard({ state, className }: ProjectionCardProps) {
  const status = toCardStatus({ data: state.projection, loading: state.loading, error: state.error, refetch: state.refetch }, false);
  return (
    <ChartCard
      title="Proyección de ventas"
      description="Cuánto venderías al terminar el mes"
      className={cn(className)}
      status={status}
      emptyText=""
      skeletonClassName="h-40"
      actions={<TrendingUp aria-hidden="true" className="size-5 text-chart-income" />}
    >
      {state.projection && <ProjectionBody projection={state.projection} lastMonthCents={state.lastMonthIncomeCents} />}
    </ChartCard>
  );
}
