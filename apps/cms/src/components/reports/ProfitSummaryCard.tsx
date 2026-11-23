import { formatPEN, marginPct, type ReportSummary } from '@sabor/shared';
import { cn } from '../../lib/utils';
import { formatMargin } from '../../lib/dashboardFormat';
import { ChartCard, toCardStatus } from '../dashboard/ChartCard';

interface StepProps {
  sign: string;
  label: string;
  cents: number;
  /** Largo de la barra respecto del mayor monto (0-100). */
  widthPct: number;
  barClassName: string;
  isTotal?: boolean;
}

const MIN_BAR_PERCENT = 2;

function Step({ sign, label, cents, widthPct, barClassName, isTotal }: StepProps) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className={cn('min-w-0', isTotal ? 'font-bold text-text' : 'font-medium text-text')}>
          <span aria-hidden="true" className="mr-1.5 inline-block w-3 text-center text-text-muted">
            {sign}
          </span>
          {label}
        </span>
        <span className={cn('shrink-0 tabular-nums', isTotal ? 'font-display text-lg font-bold' : 'font-semibold')}>
          {formatPEN(cents)}
        </span>
      </div>
      <div aria-hidden="true" className="h-3 w-full rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', barClassName)}
          style={{ width: `${cents === 0 ? 0 : Math.max(widthPct, MIN_BAR_PERCENT)}%` }}
        />
      </div>
    </li>
  );
}

interface ProfitSummaryCardProps {
  summary: ReportSummary | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  className?: string;
}

/**
 * Cascada simple Ingresos → Egresos → Ganancia neta. No hay costos de producto
 * en los datos (recetas/insumos por plato), así que NO se calcula utilidad
 * bruta: se avisa en vez de inventarla.
 */
export function ProfitSummaryCard({ summary, loading, error, onRetry, className }: ProfitSummaryCardProps) {
  const current = summary?.current;
  const status = toCardStatus({ data: summary, loading, error, refetch: onRetry }, false);
  const scale = current ? Math.max(current.incomeCents, current.expensesCents, Math.abs(current.profitCents), 1) : 1;
  const pct = (cents: number): number => (Math.abs(cents) / scale) * 100;
  const margin = current ? marginPct(current.profitCents, current.incomeCents) : null;
  const isLoss = (current?.profitCents ?? 0) < 0;

  return (
    <ChartCard
      title="Resumen de ganancias"
      description="Lo que entró, lo que salió y lo que te quedó"
      className={className}
      status={status}
      emptyText=""
      skeletonClassName="h-48"
      footnote="Aún no se registran costos de producto, por eso no se muestra utilidad bruta (ventas menos costo de lo vendido). La ganancia neta es ingresos menos los egresos registrados."
    >
      {current && (
        <div className="flex flex-col gap-4">
          <ol aria-label="Ingresos, egresos y ganancia neta" className="flex flex-col gap-3">
            <Step sign="" label="Ingresos" cents={current.incomeCents} widthPct={pct(current.incomeCents)} barClassName="bg-chart-income" />
            <Step sign="−" label="Egresos" cents={current.expensesCents} widthPct={pct(current.expensesCents)} barClassName="bg-chart-expense" />
            <Step
              sign="="
              label={isLoss ? 'Pérdida neta' : 'Ganancia neta'}
              cents={current.profitCents}
              widthPct={pct(current.profitCents)}
              barClassName={isLoss ? 'bg-chart-expense' : 'bg-chart-net'}
              isTotal
            />
          </ol>
          <p className="text-sm text-text">
            {margin === null
              ? 'Sin ingresos en este período: no hay margen que calcular.'
              : `Por cada S/ 100 que vendiste, te quedaron ${formatPEN(Math.round(margin * 100))} (margen ${formatMargin(margin)}).`}
          </p>
        </div>
      )}
    </ChartCard>
  );
}
