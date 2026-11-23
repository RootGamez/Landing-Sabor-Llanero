import { useState } from 'react';
import { formatPEN, type ReportRange, type TopCategoryRow } from '@sabor/shared';
import { useReportTopCategories } from '../../hooks/useReports';
import { formatCount, formatShare } from '../../lib/dashboardFormat';
import { BarList, type BarListItem } from '../dashboard/BarList';
import { ChartCard, toCardStatus } from '../dashboard/ChartCard';
import { SegmentedControl } from '../dashboard/SegmentedControl';

type CategorySort = 'amount' | 'quantity';

const SORT_OPTIONS: ReadonlyArray<{ value: CategorySort; label: string }> = [
  { value: 'amount', label: 'Importe' },
  { value: 'quantity', label: 'Cantidad' },
];

const unitsText = (n: number): string => `${formatCount(n)} u.`;

function toItem(row: TopCategoryRow, sort: CategorySort, total: number): BarListItem {
  const isQuantity = sort === 'quantity';
  return {
    key: row.name,
    label: row.name,
    value: isQuantity ? row.quantity : row.totalCents,
    valueText: isQuantity ? unitsText(row.quantity) : formatPEN(row.totalCents),
    secondaryText: isQuantity ? formatPEN(row.totalCents) : `${formatShare(row.totalCents, total)} · ${unitsText(row.quantity)}`,
  };
}

/** Ventas por categoría de la carta (pizzas, bebidas…), ordenadas por importe o cantidad. */
export function TopCategoriesCard({ range }: { range: ReportRange }) {
  const [sort, setSort] = useState<CategorySort>('amount');
  const state = useReportTopCategories(range);
  const rows = state.data?.rows ?? [];
  const total = rows.reduce((sum, r) => sum + r.totalCents, 0);
  const sorted = sort === 'amount' ? rows : [...rows].sort((a, b) => b.quantity - a.quantity || b.totalCents - a.totalCents);
  return (
    <ChartCard
      title="Categorías más vendidas"
      description="Qué parte de la carta te da más ventas"
      status={toCardStatus(state, rows.length === 0)}
      emptyText="No hay ventas con productos en este período."
      skeletonClassName="h-56"
      footnote="No incluye las ventas importadas de HomeBank: no traen detalle de productos."
      actions={<SegmentedControl label="Ordenar categorías por" options={SORT_OPTIONS} value={sort} onChange={setSort} />}
    >
      <BarList ariaLabel="Categorías más vendidas" barClassName="bg-chart-income" items={sorted.map((r) => toItem(r, sort, total))} />
    </ChartCard>
  );
}
