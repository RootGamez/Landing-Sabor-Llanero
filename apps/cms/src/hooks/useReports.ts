import type { ReportGranularity, ReportRange } from '@sabor/shared';
import {
  fetchExpensesByCategory,
  fetchSalesByHour,
  fetchSalesByPayment,
  fetchSalesByWeekday,
  fetchSummary,
  fetchTimeseries,
  fetchTopCategories,
  fetchTopProducts,
} from '../lib/reportsApi';
import { useAsync } from './useAsync';

/**
 * Un hook por tarjeta del dashboard: cada una carga, falla y reintenta por su
 * cuenta (un reporte lento o caído no bloquea al resto).
 */
export const useReportSummary = ({ from, to }: ReportRange) =>
  useAsync(() => fetchSummary({ from, to }), [from, to]);

export const useReportTimeseries = ({ from, to }: ReportRange, granularity: ReportGranularity) =>
  useAsync(() => fetchTimeseries({ from, to }, granularity), [from, to, granularity]);

export const useReportTopProducts = ({ from, to }: ReportRange) =>
  useAsync(() => fetchTopProducts({ from, to }), [from, to]);

export const useReportSalesByHour = ({ from, to }: ReportRange) =>
  useAsync(() => fetchSalesByHour({ from, to }), [from, to]);

export const useReportSalesByWeekday = ({ from, to }: ReportRange) =>
  useAsync(() => fetchSalesByWeekday({ from, to }), [from, to]);

export const useReportExpensesByCategory = ({ from, to }: ReportRange) =>
  useAsync(() => fetchExpensesByCategory({ from, to }), [from, to]);

export const useReportSalesByPayment = ({ from, to }: ReportRange) =>
  useAsync(() => fetchSalesByPayment({ from, to }), [from, to]);

export const useReportTopCategories = ({ from, to }: ReportRange) =>
  useAsync(() => fetchTopCategories({ from, to }), [from, to]);
