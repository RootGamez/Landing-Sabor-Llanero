import type {
  ExpenseCategoryReportRow,
  PeriodDeltas,
  PeriodTotals,
  ReportGranularity,
  ReportRange,
  SalesByHourRow,
  SalesByWeekdayRow,
  TimeseriesPoint,
} from '@sabor/shared';
import { bucketStart, enumerateBuckets } from './report-range';

/** Agregados crudos de ventas de un período (una sola fila de SQL). */
export interface SalesTotalsRow {
  incomeCents: number;
  ticketIncomeCents: number;
  tickets: number;
  summaryIncomeCents: number;
}

export interface DayAmountRow {
  day: string;
  cents: number;
}

export interface CategoryAmountRow {
  categoryId: number;
  name: string;
  parentId: number | null;
  parentName: string | null;
  color: string | null;
  parentColor: string | null;
  totalCents: number;
}

export interface KeyedCountRow {
  key: number;
  salesCount: number;
  totalCents: number;
}

const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const PCT_DECIMALS_FACTOR = 10;

export function toPeriodTotals(sales: SalesTotalsRow, expensesCents: number): PeriodTotals {
  return {
    incomeCents: sales.incomeCents,
    expensesCents,
    profitCents: sales.incomeCents - expensesCents,
    salesCount: sales.tickets,
    averageTicketCents: sales.tickets > 0 ? Math.round(sales.ticketIncomeCents / sales.tickets) : null,
  };
}

/** Variación % con un decimal; null si no hay base (anterior 0 o desconocido). */
export function deltaPct(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100 * PCT_DECIMALS_FACTOR) / PCT_DECIMALS_FACTOR;
}

export function toDeltas(current: PeriodTotals, previous: PeriodTotals): PeriodDeltas {
  return {
    income: deltaPct(current.incomeCents, previous.incomeCents),
    expenses: deltaPct(current.expensesCents, previous.expensesCents),
    profit: deltaPct(current.profitCents, previous.profitCents),
    salesCount: deltaPct(current.salesCount, previous.salesCount),
    averageTicket: deltaPct(current.averageTicketCents, previous.averageTicketCents),
  };
}

/** Ingresos/egresos por día → buckets (día, semana o mes) sin huecos. */
export function bucketTimeseries(
  range: ReportRange,
  granularity: ReportGranularity,
  income: readonly DayAmountRow[],
  expenses: readonly DayAmountRow[],
): TimeseriesPoint[] {
  const totals = new Map<string, { incomeCents: number; expensesCents: number }>(
    enumerateBuckets(range, granularity).map((bucket) => [bucket, { incomeCents: 0, expensesCents: 0 }]),
  );
  const add = (rows: readonly DayAmountRow[], field: 'incomeCents' | 'expensesCents') => {
    for (const row of rows) {
      const slot = totals.get(bucketStart(row.day, granularity));
      if (slot) slot[field] += row.cents;
    }
  };
  add(income, 'incomeCents');
  add(expenses, 'expensesCents');
  return [...totals.entries()].map(([bucket, t]) => ({ bucket, ...t }));
}

/** 24 horas de Lima (0-23), rellenando con cero las que no tuvieron ventas. */
export function fillHours(rows: readonly KeyedCountRow[]): SalesByHourRow[] {
  const byHour = new Map(rows.map((r) => [r.key, r]));
  return Array.from({ length: HOURS_PER_DAY }, (_, hour) => ({
    hour,
    salesCount: byHour.get(hour)?.salesCount ?? 0,
    totalCents: byHour.get(hour)?.totalCents ?? 0,
  }));
}

/** `%w` de SQLite (0 = domingo) → ISO (1 = lunes … 7 = domingo), lunes primero. */
export function fillWeekdays(rows: readonly KeyedCountRow[]): SalesByWeekdayRow[] {
  const byIso = new Map(rows.map((r) => [r.key === 0 ? DAYS_PER_WEEK : r.key, r]));
  return Array.from({ length: DAYS_PER_WEEK }, (_, i) => ({
    weekday: i + 1,
    salesCount: byIso.get(i + 1)?.salesCount ?? 0,
    totalCents: byIso.get(i + 1)?.totalCents ?? 0,
  }));
}

/** Gastos por categoría hoja → padres con sus hijas agregadas (2 niveles), de mayor a menor. */
export function groupCategories(rows: readonly CategoryAmountRow[]): ExpenseCategoryReportRow[] {
  const roots = new Map<number, ExpenseCategoryReportRow>();
  for (const row of rows) {
    const isChild = row.parentId !== null;
    const rootId = row.parentId ?? row.categoryId;
    const root: ExpenseCategoryReportRow = roots.get(rootId) ?? {
      categoryId: rootId,
      name: isChild ? (row.parentName ?? row.name) : row.name,
      color: isChild ? row.parentColor : row.color,
      totalCents: 0,
      directCents: 0,
      children: [],
    };
    roots.set(rootId, {
      ...root,
      totalCents: root.totalCents + row.totalCents,
      directCents: isChild ? root.directCents : root.directCents + row.totalCents,
      children: isChild
        ? [...root.children, { categoryId: row.categoryId, name: row.name, totalCents: row.totalCents }]
        : root.children,
    });
  }
  return [...roots.values()]
    .map((r) => ({ ...r, children: [...r.children].sort((a, b) => b.totalCents - a.totalCents) }))
    .sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name, 'es'));
}
