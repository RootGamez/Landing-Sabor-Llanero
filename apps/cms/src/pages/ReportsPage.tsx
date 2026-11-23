import { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ReportRange } from '@sabor/shared';
import { useReportSummary } from '../hooks/useReports';
import { useMonthProjection } from '../hooks/useMonthProjection';
import { periodFromParams, periodToParams, type PeriodKey } from '../lib/dashboardFormat';
import { ErrorState } from '../components/ui/ErrorState';
import { KpiTiles } from '../components/dashboard/KpiTiles';
import { PeriodSelector } from '../components/dashboard/PeriodSelector';
import {
  ExpensesByCategoryCard,
  SalesByPaymentCard,
  TopProductsCard,
} from '../components/dashboard/RankingCards';
import { SalesByHourCard, SalesByWeekdayCard, TimeseriesCard } from '../components/dashboard/TrendCards';
import { ProfitSummaryCard } from '../components/reports/ProfitSummaryCard';
import { ProjectionCard } from '../components/reports/ProjectionCard';
import { ExportButton, ReportExportProvider, ReportHeader } from '../components/reports/ReportExport';
import { TopCategoriesCard } from '../components/reports/TopCategoriesCard';
import { WebMenuReports } from '../components/reports/WebMenuReports';

/**
 * Reportes financieros (owner/admin): ingresos y egresos juntos, ganancia neta,
 * lo más vendido, proyección del mes y exportación a imagen. El período vive
 * en la URL (`?p=` o `?p=personalizado&from=&to=`), igual que en el Dashboard.
 */
export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const { key, range } = periodFromParams(params);
  const summary = useReportSummary(range);
  const projection = useMonthProjection(range);
  const captureRef = useRef<HTMLDivElement>(null);

  const handlePeriodChange = (nextKey: PeriodKey, nextRange: ReportRange) => {
    setParams(periodToParams(nextKey, nextRange), { replace: true });
  };

  return (
    <ReportExportProvider range={range}>
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-text">Reportes</h1>
            <p className="text-sm text-text-muted">Ingresos, egresos y ganancias en un solo lugar.</p>
          </div>
          <ExportButton targetRef={captureRef} title="reporte-completo" variant="full" />
        </div>

        <PeriodSelector period={key} range={range} onChange={handlePeriodChange} />

        <div ref={captureRef} className="flex flex-col gap-4 rounded-xl2 bg-bone p-3 sm:p-4">
          <ReportHeader range={range} />

          {summary.error ? (
            <ErrorState message={summary.error} onRetry={summary.refetch} />
          ) : (
            <KpiTiles summary={summary.data} loading={summary.loading} />
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ProfitSummaryCard
              summary={summary.data}
              loading={summary.loading}
              error={summary.error}
              onRetry={summary.refetch}
              className={projection.enabled ? undefined : 'lg:col-span-2'}
            />
            {projection.enabled && <ProjectionCard state={projection} />}
            <TimeseriesCard
              key={`${range.from}|${range.to}`}
              range={range}
              showNet
              projection={projection.projection?.status === 'ok' ? projection.projection.days : undefined}
            />
            <TopProductsCard range={range} />
            <TopCategoriesCard range={range} />
            <ExpensesByCategoryCard range={range} />
            <SalesByPaymentCard range={range} />
            <SalesByHourCard range={range} />
            <SalesByWeekdayCard range={range} />
          </div>
        </div>

        <WebMenuReports />
      </div>
    </ReportExportProvider>
  );
}
