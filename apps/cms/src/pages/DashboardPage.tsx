import { useSearchParams } from 'react-router-dom';
import type { ReportRange } from '@sabor/shared';
import { useReportSummary } from '../hooks/useReports';
import { periodFromParams, periodToParams, type PeriodKey } from '../lib/dashboardFormat';
import { ErrorState } from '../components/ui/ErrorState';
import { KpiTiles } from '../components/dashboard/KpiTiles';
import { PendingOrdersSection } from '../components/dashboard/PendingOrdersSection';
import { PeriodSelector } from '../components/dashboard/PeriodSelector';
import {
  ExpensesByCategoryCard,
  SalesByPaymentCard,
  TopProductsCard,
} from '../components/dashboard/RankingCards';
import { SalesByHourCard, SalesByWeekdayCard, TimeseriesCard } from '../components/dashboard/TrendCards';

/**
 * Inicio del back-office (owner/admin; el cajero ya se redirige al POS): cómo
 * va el negocio en el período elegido (se guarda en la URL, así se puede
 * compartir o recargar) y, abajo, los pedidos web por aceptar.
 */
export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const { key, range } = periodFromParams(params);
  const summary = useReportSummary(range);

  const handlePeriodChange = (nextKey: PeriodKey, nextRange: ReportRange) => {
    // Al pasar a "Personalizado" se parte del rango que se estaba viendo.
    setParams(periodToParams(nextKey, nextRange), { replace: true });
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Dashboard</h1>
        <p className="text-sm text-text-muted">Cómo va el negocio: ingresos, egresos y lo que más se vende.</p>
      </div>

      <PeriodSelector period={key} range={range} onChange={handlePeriodChange} />

      {summary.error ? (
        <ErrorState message={summary.error} onRetry={summary.refetch} />
      ) : (
        <KpiTiles summary={summary.data} loading={summary.loading} />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TimeseriesCard key={`${range.from}|${range.to}`} range={range} />
        <TopProductsCard range={range} />
        <ExpensesByCategoryCard range={range} />
        <SalesByHourCard range={range} />
        <SalesByWeekdayCard range={range} />
        <SalesByPaymentCard range={range} />
      </div>

      <PendingOrdersSection />
    </div>
  );
}
