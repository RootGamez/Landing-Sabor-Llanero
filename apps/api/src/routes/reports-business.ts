import { Hono } from 'hono';
import { comparisonRange } from '@sabor/shared';
import type {
  ExpensesByCategoryReport,
  ReportSummary,
  SalesByHourRow,
  SalesByPaymentRow,
  SalesByWeekdayRow,
  SalesDistributionReport,
  TimeseriesReport,
  TopCategoriesReport,
  TopCategoryRow,
  TopProductRow,
  TopProductsReport,
} from '@sabor/shared';
import type { AppEnv } from '../env';
import { requireAuth, requireRole } from '../middleware/auth';
import { badRequest } from '../lib/http-error';
import {
  bucketTimeseries,
  fillHours,
  fillWeekdays,
  groupCategories,
  toDeltas,
  toPeriodTotals,
  type CategoryAmountRow,
  type DayAmountRow,
  type KeyedCountRow,
  type SalesTotalsRow,
} from '../lib/report-aggregate';
import {
  expensesByCategoryStatement,
  expensesByDayStatement,
  expensesTotalStatement,
  HOUR_KEY,
  incomeByDayStatement,
  salesByKeyStatement,
  salesByPaymentStatement,
  salesTotalsStatement,
  summaryIncomeStatement,
  topCategoriesStatement,
  topProductsStatement,
  WEEKDAY_KEY,
} from '../lib/report-queries';
import { parseGranularity, parseReportRange } from '../lib/report-range';

/** Reportes del dashboard general (Plan Parte 3, F9). Solo owner/admin; el cajero recibe 403. */
export const businessReportRoutes = new Hono<AppEnv>();
businessReportRoutes.use('*', requireAuth, requireRole('owner', 'admin'));

const TOP_LIMIT_DEFAULT = 10;
const TOP_LIMIT_MAX = 50;

function parseLimit(raw: string | undefined): number {
  if (raw === undefined || raw === '') return TOP_LIMIT_DEFAULT;
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > TOP_LIMIT_MAX) {
    throw badRequest(`limit inválido (entero entre 1 y ${TOP_LIMIT_MAX})`);
  }
  return limit;
}

const firstRow = <T>(result: D1Result | undefined, fallback: T): T => (result?.results[0] as T | undefined) ?? fallback;
const rowsOf = <T>(result: D1Result | undefined): T[] => (result?.results ?? []) as T[];
const totalOf = (result: D1Result | undefined): number => firstRow<{ total: number }>(result, { total: 0 }).total;

const EMPTY_SALES: SalesTotalsRow = { incomeCents: 0, ticketIncomeCents: 0, tickets: 0, summaryIncomeCents: 0 };

businessReportRoutes.get('/summary', async (c) => {
  const range = parseReportRange(c);
  const previous = comparisonRange(range);
  const db = c.env.DB;
  const [sales, expenses, prevSales, prevExpenses] = await db.batch([
    salesTotalsStatement(db, range),
    expensesTotalStatement(db, range),
    salesTotalsStatement(db, previous),
    expensesTotalStatement(db, previous),
  ]);
  const salesRow = firstRow(sales, EMPTY_SALES);
  const current = toPeriodTotals(salesRow, totalOf(expenses));
  const prior = toPeriodTotals(firstRow(prevSales, EMPTY_SALES), totalOf(prevExpenses));
  const body: ReportSummary = {
    range,
    previousRange: previous,
    current,
    previous: prior,
    deltaPct: toDeltas(current, prior),
    summaryIncomeCents: salesRow.summaryIncomeCents,
  };
  return c.json(body);
});

businessReportRoutes.get('/timeseries', async (c) => {
  const range = parseReportRange(c);
  const granularity = parseGranularity(c);
  const db = c.env.DB;
  const [income, expenses] = await db.batch([incomeByDayStatement(db, range), expensesByDayStatement(db, range)]);
  const body: TimeseriesReport = {
    range,
    granularity,
    points: bucketTimeseries(range, granularity, rowsOf<DayAmountRow>(income), rowsOf<DayAmountRow>(expenses)),
  };
  return c.json(body);
});

businessReportRoutes.get('/top-products', async (c) => {
  const range = parseReportRange(c);
  const limit = parseLimit(c.req.query('limit'));
  const db = c.env.DB;
  const [byQuantity, byAmount] = await db.batch([
    topProductsStatement(db, range, 'quantity', limit),
    topProductsStatement(db, range, 'amount', limit),
  ]);
  const body: TopProductsReport = {
    range,
    byQuantity: rowsOf<TopProductRow>(byQuantity),
    byAmount: rowsOf<TopProductRow>(byAmount),
  };
  return c.json(body);
});

businessReportRoutes.get('/top-categories', async (c) => {
  const range = parseReportRange(c);
  const limit = parseLimit(c.req.query('limit'));
  const { results } = await topCategoriesStatement(c.env.DB, range, limit).all<TopCategoryRow>();
  const body: TopCategoriesReport = { range, rows: results };
  return c.json(body);
});

businessReportRoutes.get('/sales-by-hour', async (c) => {
  const range = parseReportRange(c);
  const db = c.env.DB;
  const [rows, excluded] = await db.batch([salesByKeyStatement(db, range, HOUR_KEY), summaryIncomeStatement(db, range)]);
  const body: SalesDistributionReport<SalesByHourRow> = {
    range,
    rows: fillHours(rowsOf<KeyedCountRow>(rows)),
    excludedSummaryCents: totalOf(excluded),
  };
  return c.json(body);
});

businessReportRoutes.get('/sales-by-weekday', async (c) => {
  const range = parseReportRange(c);
  const db = c.env.DB;
  const [rows, excluded] = await db.batch([
    salesByKeyStatement(db, range, WEEKDAY_KEY),
    summaryIncomeStatement(db, range),
  ]);
  const body: SalesDistributionReport<SalesByWeekdayRow> = {
    range,
    rows: fillWeekdays(rowsOf<KeyedCountRow>(rows)),
    excludedSummaryCents: totalOf(excluded),
  };
  return c.json(body);
});

businessReportRoutes.get('/expenses-by-category', async (c) => {
  const range = parseReportRange(c);
  const { results } = await expensesByCategoryStatement(c.env.DB, range).all<CategoryAmountRow>();
  const rows = groupCategories(results);
  const body: ExpensesByCategoryReport = {
    range,
    totalCents: rows.reduce((sum, r) => sum + r.totalCents, 0),
    rows,
  };
  return c.json(body);
});

businessReportRoutes.get('/sales-by-payment', async (c) => {
  const range = parseReportRange(c);
  const db = c.env.DB;
  const [rows, excluded] = await db.batch([salesByPaymentStatement(db, range), summaryIncomeStatement(db, range)]);
  const body: SalesDistributionReport<SalesByPaymentRow> = {
    range,
    rows: rowsOf<SalesByPaymentRow>(rows),
    excludedSummaryCents: totalOf(excluded),
  };
  return c.json(body);
});
