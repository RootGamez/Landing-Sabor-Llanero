import { useState } from 'react';
import { formatPEN, type ExpenseCategoryReportRow, type ReportRange, type TopProductRow } from '@sabor/shared';
import {
  useReportExpensesByCategory,
  useReportSalesByPayment,
  useReportTopProducts,
} from '../../hooks/useReports';
import { formatCount, formatShare } from '../../lib/dashboardFormat';
import { BarList, type BarListItem } from './BarList';
import { ChartCard, toCardStatus } from './ChartCard';
import { SegmentedControl } from './SegmentedControl';

interface RangeProps {
  range: ReportRange;
}

type ProductSort = 'quantity' | 'amount';

const PRODUCT_SORT_OPTIONS: ReadonlyArray<{ value: ProductSort; label: string }> = [
  { value: 'quantity', label: 'Cantidad' },
  { value: 'amount', label: 'Importe' },
];

const CHILDREN_SHOWN = 3;

const productLabel = (p: TopProductRow): string => (p.sizeLabel ? `${p.name} (${p.sizeLabel})` : p.name);
const unitsText = (n: number): string => `${formatCount(n)} u.`;

function productItem(p: TopProductRow, sort: ProductSort): BarListItem {
  const isQuantity = sort === 'quantity';
  return {
    key: `${p.name}|${p.sizeLabel ?? ''}`,
    label: productLabel(p),
    value: isQuantity ? p.quantity : p.totalCents,
    valueText: isQuantity ? unitsText(p.quantity) : formatPEN(p.totalCents),
    secondaryText: isQuantity ? formatPEN(p.totalCents) : unitsText(p.quantity),
  };
}

export function TopProductsCard({ range }: RangeProps) {
  const [sort, setSort] = useState<ProductSort>('quantity');
  const state = useReportTopProducts(range);
  const rows = (sort === 'quantity' ? state.data?.byQuantity : state.data?.byAmount) ?? [];
  return (
    <ChartCard
      title="Productos más vendidos"
      description="Los 10 primeros por cantidad o por importe"
      status={toCardStatus(state, rows.length === 0)}
      emptyText="No hay ventas con productos en este período."
      skeletonClassName="h-80"
      footnote="No incluye las ventas importadas de HomeBank: no traen detalle de productos."
      actions={<SegmentedControl label="Ordenar por" options={PRODUCT_SORT_OPTIONS} value={sort} onChange={setSort} />}
    >
      <BarList
        ariaLabel="Productos más vendidos"
        barClassName="bg-chart-income"
        items={rows.map((p) => productItem(p, sort))}
      />
    </ChartCard>
  );
}

function categoryItem(row: ExpenseCategoryReportRow, total: number): BarListItem {
  const visibleChildren = row.children.slice(0, CHILDREN_SHOWN);
  const hiddenCount = row.children.length - visibleChildren.length;
  return {
    key: String(row.categoryId),
    label: row.name,
    value: row.totalCents,
    valueText: formatPEN(row.totalCents),
    secondaryText: formatShare(row.totalCents, total),
    detail:
      row.children.length > 0 ? (
        <ul className="ml-3 flex flex-col gap-0.5 border-l-2 border-border pl-3 text-xs text-text-muted">
          {visibleChildren.map((c) => (
            <li key={c.categoryId} className="flex justify-between gap-3">
              <span className="min-w-0 break-words">{c.name}</span>
              <span className="shrink-0 tabular-nums">{formatPEN(c.totalCents)}</span>
            </li>
          ))}
          {hiddenCount > 0 && <li>y {hiddenCount} más</li>}
        </ul>
      ) : undefined,
  };
}

export function ExpensesByCategoryCard({ range }: RangeProps) {
  const state = useReportExpensesByCategory(range);
  const rows = state.data?.rows ?? [];
  const total = state.data?.totalCents ?? 0;
  return (
    <ChartCard
      title="Egresos por categoría"
      description={total > 0 ? `Total ${formatPEN(total)}; las subcategorías suman en su categoría` : undefined}
      status={toCardStatus(state, rows.length === 0)}
      emptyText="No hay gastos registrados en este período."
      skeletonClassName="h-64"
    >
      <BarList
        ariaLabel="Egresos por categoría"
        barClassName="bg-chart-expense"
        items={rows.map((r) => categoryItem(r, total))}
      />
    </ChartCard>
  );
}

export function SalesByPaymentCard({ range }: RangeProps) {
  const state = useReportSalesByPayment(range);
  const rows = state.data?.rows ?? [];
  const total = rows.reduce((sum, r) => sum + r.totalCents, 0);
  const excluded = state.data?.excludedSummaryCents ?? 0;
  return (
    <ChartCard
      title="Ventas por método de pago"
      description="Cómo te pagan los clientes"
      status={toCardStatus(state, rows.length === 0)}
      emptyText="No hay ventas con método de pago en este período."
      skeletonClassName="h-48"
      footnote={
        excluded > 0
          ? `No incluye ${formatPEN(excluded)} de ventas importadas de HomeBank: no traen método de pago.`
          : null
      }
    >
      <BarList
        ariaLabel="Ventas por método de pago"
        barClassName="bg-chart-income"
        items={rows.map((r) => ({
          key: r.paymentMethod,
          label: r.label,
          value: r.totalCents,
          valueText: formatPEN(r.totalCents),
          secondaryText: `${formatShare(r.totalCents, total)} · ${formatCount(r.salesCount)} ${r.salesCount === 1 ? 'venta' : 'ventas'}`,
        }))}
      />
    </ChartCard>
  );
}
