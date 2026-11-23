import type {
  ExpensesByCategoryReport,
  ReportGranularity,
  ReportRange,
  ReportSummary,
  SalesByHourRow,
  SalesByPaymentRow,
  SalesByWeekdayRow,
  SalesDistributionReport,
  TimeseriesReport,
  TopCategoriesReport,
  TopProductsReport,
} from '@sabor/shared';
import { api } from './api';

/** `from`/`to` son días locales de Lima (YYYY-MM-DD), inclusivos. */
function query(range: ReportRange, extra: Record<string, string> = {}): string {
  return new URLSearchParams({ from: range.from, to: range.to, ...extra }).toString();
}

export const TOP_PRODUCTS_LIMIT = 10;

export const fetchSummary = (range: ReportRange) => api.get<ReportSummary>(`/reports/summary?${query(range)}`);

export const fetchTimeseries = (range: ReportRange, granularity: ReportGranularity) =>
  api.get<TimeseriesReport>(`/reports/timeseries?${query(range, { granularity })}`);

export const fetchTopProducts = (range: ReportRange) =>
  api.get<TopProductsReport>(`/reports/top-products?${query(range, { limit: String(TOP_PRODUCTS_LIMIT) })}`);

export const fetchSalesByHour = (range: ReportRange) =>
  api.get<SalesDistributionReport<SalesByHourRow>>(`/reports/sales-by-hour?${query(range)}`);

export const fetchSalesByWeekday = (range: ReportRange) =>
  api.get<SalesDistributionReport<SalesByWeekdayRow>>(`/reports/sales-by-weekday?${query(range)}`);

export const fetchExpensesByCategory = (range: ReportRange) =>
  api.get<ExpensesByCategoryReport>(`/reports/expenses-by-category?${query(range)}`);

export const fetchSalesByPayment = (range: ReportRange) =>
  api.get<SalesDistributionReport<SalesByPaymentRow>>(`/reports/sales-by-payment?${query(range)}`);

export const fetchTopCategories = (range: ReportRange) =>
  api.get<TopCategoriesReport>(`/reports/top-categories?${query(range, { limit: String(TOP_PRODUCTS_LIMIT) })}`);
