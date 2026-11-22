import { type ExpenseSummary, type ExpenseSummaryCategory, type PaymentMethod } from '@sabor/shared';
import type { ExpenseFilterValues } from '../../lib/expensesApi';
import { formatDayHeading, type CategoryOption } from './expenseUtils';

/** Gastos que entran en la tarjeta de 1350 px; el resto se resume como "+N más". */
export const REPORT_ITEM_LIMIT = 12;
/** Categorías con barra propia; las demás se suman en "Otras". */
const REPORT_CATEGORY_ROWS = 5;

export interface ReportCategoryRow {
  key: string;
  name: string;
  count: number;
  totalCents: number;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const longDate = (day: string) =>
  capitalize(
    new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${day}T00:00:00Z`))
      .replace(',', ''),
  );

const shortDate = (day: string) => formatDayHeading(day).replace(/^[^\s]+\s/, '');

/** "Domingo 22 de noviembre de 2026", "15 nov 2026 – 22 nov 2026", "Desde …", "Hasta …" o "Todos los gastos". */
export function periodLabel(from: string, to: string): string {
  if (from && from === to) return longDate(from);
  if (from && to) return `${shortDate(from)} – ${shortDate(to)}`;
  if (from) return `Desde ${shortDate(from)}`;
  if (to) return `Hasta ${shortDate(to)}`;
  return 'Todos los gastos';
}

/** Nombre del PNG: `egresos-2026-11-22.png` o `egresos-2026-11-15_2026-11-22.png`. */
export function reportFileName(from: string, to: string): string {
  if (from && from === to) return `egresos-${from}.png`;
  const parts = [from, to].filter(Boolean);
  return parts.length > 0 ? `egresos-${parts.join('_')}.png` : 'egresos.png';
}

/** Filtros distintos de la fecha ("Insumos · Yape · «harina»"), para que la tarjeta no parezca el total del día. */
export function describeFilters(
  filters: ExpenseFilterValues,
  categoriesById: ReadonlyMap<number, CategoryOption>,
  methods: readonly PaymentMethod[],
): string {
  const parts: string[] = [];
  if (filters.categoryId !== null) parts.push(categoriesById.get(filters.categoryId)?.label ?? 'Categoría');
  if (filters.paymentMethod) parts.push(methods.find((m) => m.key === filters.paymentMethod)?.label ?? filters.paymentMethod);
  if (filters.q.trim()) parts.push(`«${filters.q.trim()}»`);
  return parts.join(' · ');
}

/** Las 5 categorías más gastadas con su barra; el resto se suma en una fila "Otras". */
export function categoryRows(byCategory: readonly ExpenseSummaryCategory[]): ReportCategoryRow[] {
  const toRow = (c: ExpenseSummaryCategory): ReportCategoryRow => ({
    key: `c-${c.categoryId}`,
    name: c.name,
    count: c.count,
    totalCents: c.totalCents,
  });
  if (byCategory.length <= REPORT_CATEGORY_ROWS) return byCategory.map(toRow);
  const shown = byCategory.slice(0, REPORT_CATEGORY_ROWS - 1);
  const rest = byCategory.slice(REPORT_CATEGORY_ROWS - 1);
  const others: ReportCategoryRow = {
    key: 'others',
    name: `Otras (${rest.length})`,
    count: rest.reduce((sum, c) => sum + c.count, 0),
    totalCents: rest.reduce((sum, c) => sum + c.totalCents, 0),
  };
  return [...shown.map(toRow), others];
}

export interface ExpenseReportData {
  summary: ExpenseSummary;
  periodLabel: string;
  /** Texto de filtros extra ('' si solo hay rango de fechas). */
  filterNote: string;
  /** Con varios días, cada gasto lleva su fecha. */
  showDates: boolean;
  fileName: string;
}

export function toReportData(
  summary: ExpenseSummary,
  filters: ExpenseFilterValues,
  filterNote: string,
): ExpenseReportData {
  return {
    summary,
    periodLabel: periodLabel(filters.from, filters.to),
    filterNote,
    showDates: !(filters.from && filters.from === filters.to),
    fileName: reportFileName(filters.from, filters.to),
  };
}
