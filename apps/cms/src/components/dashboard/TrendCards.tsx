import { useState } from 'react';
import {
  autoGranularity,
  formatPEN,
  type ReportGranularity,
  type ReportRange,
  type SalesByHourRow,
  type SalesByWeekdayRow,
} from '@sabor/shared';
import { useReportSalesByHour, useReportSalesByWeekday, useReportTimeseries } from '../../hooks/useReports';
import {
  GRANULARITY_LABELS,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  formatCount,
  hourLabel,
} from '../../lib/dashboardFormat';
import { ChartCard, toCardStatus } from './ChartCard';
import { ColumnChart, type ColumnDatum } from './ColumnChart';
import { SegmentedControl } from './SegmentedControl';
import { TimeseriesChart } from './TimeseriesChart';

interface RangeProps {
  range: ReportRange;
}

const GRANULARITY_OPTIONS = (Object.keys(GRANULARITY_LABELS) as ReportGranularity[]).map((value) => ({
  value,
  label: GRANULARITY_LABELS[value],
}));

const HOUR_LABEL_EVERY = 3;
const SUMMARY_NOTE = (cents: number): string | null =>
  cents > 0
    ? `No incluye ${formatPEN(cents)} de ventas importadas de HomeBank: no tienen hora ni día reales.`
    : null;

const salesText = (count: number): string => `${formatCount(count)} ${count === 1 ? 'venta' : 'ventas'}`;

/** Ingresos vs egresos en el tiempo. La granularidad se elige sola según el largo del rango y se puede cambiar. */
export function TimeseriesCard({ range }: RangeProps) {
  const [override, setOverride] = useState<ReportGranularity | null>(null);
  const granularity = override ?? autoGranularity(range);
  const state = useReportTimeseries(range, granularity);
  const points = state.data?.points ?? [];
  const isEmpty = points.every((p) => p.incomeCents === 0 && p.expensesCents === 0);

  return (
    <ChartCard
      title="Ingresos y egresos"
      description="Ventas cobradas contra gastos registrados"
      className="lg:col-span-2"
      status={toCardStatus(state, isEmpty)}
      emptyText="No hay ventas ni gastos en este período."
      skeletonClassName="h-72"
      actions={
        <SegmentedControl label="Agrupar por" options={GRANULARITY_OPTIONS} value={granularity} onChange={setOverride} />
      }
    >
      <TimeseriesChart points={points} granularity={state.data?.granularity ?? granularity} />
    </ChartCard>
  );
}

function hourData(rows: readonly SalesByHourRow[]): ColumnDatum[] {
  return rows.map((r) => ({
    key: String(r.hour),
    axisLabel: `${r.hour}h`,
    title: hourLabel(r.hour),
    value: r.totalCents,
    valueText: formatPEN(r.totalCents),
    detailText: salesText(r.salesCount),
  }));
}

function weekdayData(rows: readonly SalesByWeekdayRow[]): ColumnDatum[] {
  return rows.map((r) => ({
    key: String(r.weekday),
    axisLabel: WEEKDAY_SHORT[r.weekday - 1]!,
    title: WEEKDAY_NAMES[r.weekday - 1]!.replace(/^./, (c) => c.toUpperCase()),
    value: r.totalCents,
    valueText: formatPEN(r.totalCents),
    detailText: salesText(r.salesCount),
  }));
}

export function SalesByHourCard({ range }: RangeProps) {
  const state = useReportSalesByHour(range);
  const data = hourData(state.data?.rows ?? []);
  const isEmpty = data.every((d) => d.value === 0);
  return (
    <ChartCard
      title="Ventas por hora"
      description="Ingresos por hora del día (hora de Lima)"
      status={toCardStatus(state, isEmpty)}
      emptyText="Todavía no hay ventas con hora registrada en este período."
      skeletonClassName="h-44"
      footnote={SUMMARY_NOTE(state.data?.excludedSummaryCents ?? 0)}
    >
      <ColumnChart
        data={data}
        measureLabel="Ingresos por hora"
        peakNoun="Hora"
        labelEvery={HOUR_LABEL_EVERY}
      />
    </ChartCard>
  );
}

export function SalesByWeekdayCard({ range }: RangeProps) {
  const state = useReportSalesByWeekday(range);
  const data = weekdayData(state.data?.rows ?? []);
  const isEmpty = data.every((d) => d.value === 0);
  return (
    <ChartCard
      title="Ventas por día de la semana"
      description="Suma de los ingresos de cada día de la semana"
      status={toCardStatus(state, isEmpty)}
      emptyText="Todavía no hay ventas con fecha registrada en este período."
      skeletonClassName="h-44"
      footnote={SUMMARY_NOTE(state.data?.excludedSummaryCents ?? 0)}
    >
      <ColumnChart data={data} measureLabel="Ingresos por día de la semana" peakNoun="Día" />
    </ChartCard>
  );
}
