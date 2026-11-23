/**
 * Contrato de los reportes del dashboard (Plan Parte 3, F9). Todo el dinero va
 * en céntimos (D1) y todos los rangos son fechas locales de Lima 'YYYY-MM-DD'
 * (D2), inclusivas en ambos extremos.
 */

export type ReportGranularity = 'day' | 'week' | 'month';

export interface ReportRange {
  from: string;
  to: string;
}

export interface PeriodTotals {
  incomeCents: number;
  expensesCents: number;
  profitCents: number;
  /** Tickets reales: no cuenta las ventas resumen importadas de HomeBank (1 por día). */
  salesCount: number;
  /** Ingreso de tickets reales / salesCount; null si no hubo tickets. */
  averageTicketCents: number | null;
}

/** Variación porcentual vs el período anterior; null cuando el anterior fue 0 (no hay base). */
export interface PeriodDeltas {
  income: number | null;
  expenses: number | null;
  profit: number | null;
  salesCount: number | null;
  averageTicket: number | null;
}

export interface ReportSummary {
  range: ReportRange;
  previousRange: ReportRange;
  current: PeriodTotals;
  previous: PeriodTotals;
  deltaPct: PeriodDeltas;
  /** Parte de los ingresos que viene de ventas resumen importadas (sin detalle de ticket/producto/hora). */
  summaryIncomeCents: number;
}

export interface TimeseriesPoint {
  /** Primer día del bucket (día, lunes de la semana, o día 1 del mes) como 'YYYY-MM-DD'. */
  bucket: string;
  incomeCents: number;
  expensesCents: number;
}

export interface TimeseriesReport {
  range: ReportRange;
  granularity: ReportGranularity;
  points: TimeseriesPoint[];
}

export interface TopProductRow {
  name: string;
  sizeLabel: string | null;
  quantity: number;
  totalCents: number;
}

export interface TopProductsReport {
  range: ReportRange;
  byQuantity: TopProductRow[];
  byAmount: TopProductRow[];
}

export interface SalesByHourRow {
  /** Hora local de Lima, 0-23. */
  hour: number;
  salesCount: number;
  totalCents: number;
}

export interface SalesByWeekdayRow {
  /** ISO: 1 = lunes … 7 = domingo. */
  weekday: number;
  salesCount: number;
  totalCents: number;
}

export interface SalesDistributionReport<Row> {
  range: ReportRange;
  rows: Row[];
  /** Ingresos que no entran en la distribución por ser ventas resumen (sin hora ni método reales). */
  excludedSummaryCents: number;
}

export interface ExpenseCategoryReportChild {
  categoryId: number;
  name: string;
  totalCents: number;
}

export interface ExpenseCategoryReportRow {
  categoryId: number;
  name: string;
  color: string | null;
  /** Propios + los de sus subcategorías. */
  totalCents: number;
  /** Solo los registrados directamente en la categoría padre. */
  directCents: number;
  children: ExpenseCategoryReportChild[];
}

export interface ExpensesByCategoryReport {
  range: ReportRange;
  totalCents: number;
  rows: ExpenseCategoryReportRow[];
}

export interface SalesByPaymentRow {
  paymentMethod: string;
  label: string;
  salesCount: number;
  totalCents: number;
}

export interface TopCategoryRow {
  /** Nombre de la categoría del menú; 'Sin categoría' cuando el ítem ya no existe en la carta. */
  name: string;
  quantity: number;
  totalCents: number;
}

export interface TopCategoriesReport {
  range: ReportRange;
  rows: TopCategoryRow[];
}
