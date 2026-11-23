import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { formatPEN, marginPct, type PeriodTotals, type ReportSummary } from '@sabor/shared';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/Skeleton';
import { cn } from '../../lib/utils';
import { formatCount, formatDeltaPct, formatMargin, formatRangeLabel } from '../../lib/dashboardFormat';

/** Por debajo de esto (0,05 %) el cambio se redondea a 0 y se muestra como "igual". */
const MIN_VISIBLE_DELTA = 0.05;

/** Qué dirección del cambio es buena: subir ingresos es bueno, subir egresos no. */
type Polarity = 'higher-better' | 'higher-worse';

interface DeltaProps {
  pct: number | null | undefined;
  polarity: Polarity;
}

/** Variación vs el período anterior: flecha + texto (nunca solo color). */
function Delta({ pct, polarity }: DeltaProps) {
  if (pct === null || pct === undefined) {
    return (
      <span className="flex items-center gap-1 text-xs text-text-muted">
        <Minus aria-hidden="true" className="size-3.5" />
        Sin base para comparar
      </span>
    );
  }
  if (Math.abs(pct) < MIN_VISIBLE_DELTA) {
    return (
      <span className="flex items-center gap-1 text-xs text-text-muted">
        <Minus aria-hidden="true" className="size-3.5" />
        Igual que el período anterior
      </span>
    );
  }
  const isUp = pct > 0;
  const isGood = isUp === (polarity === 'higher-better');
  const Icon = isUp ? ArrowUp : ArrowDown;
  return (
    <span className={cn('flex items-center gap-1 text-xs font-semibold', isGood ? 'text-success' : 'text-destructive')}>
      <Icon aria-hidden="true" className="size-3.5" />
      <span>
        {formatDeltaPct(pct)}
        <span className="sr-only">{isUp ? ' más' : ' menos'} que el período anterior</span>
      </span>
      <span aria-hidden="true" className="font-normal text-text-muted">
        vs. anterior
      </span>
    </span>
  );
}

interface TileProps {
  label: string;
  value: string | undefined;
  pct: number | null | undefined;
  polarity: Polarity;
  loading: boolean;
  highlight?: boolean;
  /** Dato extra bajo el valor (margen %). */
  note?: string;
  className?: string;
}

function KpiTile({ label, value, pct, polarity, loading, highlight, note, className }: TileProps) {
  return (
    <Card className={cn(highlight && 'border-primary/60', className)}>
      <CardContent className="gap-1 py-4">
        <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{label}</span>
        {loading || value === undefined ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <span className="font-display text-xl font-bold tabular-nums text-text sm:text-2xl">{value}</span>
        )}
        {note && !loading && <span className="text-xs font-semibold text-text">{note}</span>}
        {loading ? <Skeleton className="h-4 w-24" /> : <Delta pct={pct} polarity={polarity} />}
      </CardContent>
    </Card>
  );
}

const tickets = (totals: PeriodTotals | undefined): string | undefined =>
  totals && (totals.averageTicketCents === null ? '—' : formatPEN(totals.averageTicketCents));

/** "Margen 25,3 %" (sobre los ingresos); sin ingresos no hay margen que mostrar. */
function marginNote(totals: PeriodTotals): string | undefined {
  const pct = marginPct(totals.profitCents, totals.incomeCents);
  return pct === null ? undefined : `Margen ${formatMargin(pct)}`;
}

interface KpiTilesProps {
  summary: ReportSummary | undefined;
  loading: boolean;
}

export function KpiTiles({ summary, loading }: KpiTilesProps) {
  const current = summary?.current;
  const deltas = summary?.deltaPct;
  const isLoading = loading && !summary;
  const margin = current ? marginNote(current) : undefined;
  return (
    <section
      aria-label="Indicadores del período"
      aria-busy={loading}
      className={cn('flex flex-col gap-2 transition-opacity', loading && summary && 'opacity-60')}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-5">
        <KpiTile label="Ingresos" value={current && formatPEN(current.incomeCents)} pct={deltas?.income} polarity="higher-better" loading={isLoading} />
        <KpiTile label="Egresos" value={current && formatPEN(current.expensesCents)} pct={deltas?.expenses} polarity="higher-worse" loading={isLoading} />
        <KpiTile
          label="Ganancia neta"
          value={current && formatPEN(current.profitCents)}
          note={margin}
          pct={deltas?.profit}
          polarity="higher-better"
          loading={isLoading}
          highlight
          className="col-span-2 sm:col-span-1"
        />
        <KpiTile label="Ventas" value={current && formatCount(current.salesCount)} pct={deltas?.salesCount} polarity="higher-better" loading={isLoading} />
        <KpiTile label="Ticket promedio" value={tickets(current)} pct={deltas?.averageTicket} polarity="higher-better" loading={isLoading} />
      </div>
      {summary && (
        <p className="text-xs text-text-muted">
          Comparado con el período equivalente anterior: {formatRangeLabel(summary.previousRange)}.
          {summary.summaryIncomeCents > 0 &&
            ` Los ingresos incluyen ${formatPEN(summary.summaryIncomeCents)} de ventas importadas de HomeBank sin detalle de tickets: no cuentan en el ticket promedio ni en el número de ventas.`}
        </p>
      )}
    </section>
  );
}
