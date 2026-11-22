import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import type {
  ExpensesByCategoryReport,
  ReportSummary,
  SalesByHourRow,
  SalesByPaymentRow,
  SalesByWeekdayRow,
  SalesDistributionReport,
  TimeseriesReport,
  TopProductsReport,
} from '@sabor/shared';
import { api, createUser, type TestUser } from '../../test/pos-fixtures';

/**
 * Datos sembrados en horas de Lima (UTC-5). El caso borde es la venta B:
 * 23:30 del día 10 en Lima = 04:30 del día 11 en UTC.
 *   A  10/03 12:00 Lima  efectivo 3000  Pizza Grande x1
 *   B  10/03 23:30 Lima  yape     2000  Gaseosa x2
 *   C  11/03 00:30 Lima  efectivo 3000  Pizza Grande x1
 *   D  11/03 anulada 99999 (no cuenta)
 *   E  10/03 12:00 Lima  homebank 50000 resumen (sin hora/producto/método reales)
 *   F  09/03 12:00 Lima  efectivo 10000 (período anterior)
 */
const RANGE = 'from=2026-03-10&to=2026-03-11';

let sessionId = 0;
let saleNumber = 0;

interface SaleSeed {
  createdAtUtc: string;
  totalCents: number;
  method: string;
  source?: 'pos' | 'homebank';
  voided?: boolean;
  items: Array<{ name: string; sizeLabel: string | null; unitCents: number; quantity: number }>;
}

async function insertSale(seed: SaleSeed): Promise<void> {
  saleNumber += 1;
  const sale = await env.DB.prepare(
    `INSERT INTO sales (session_id, number, created_at, subtotal_cents, total_cents, payment_method, source,
                        voided_at, void_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(
      sessionId,
      saleNumber,
      seed.createdAtUtc,
      seed.totalCents,
      seed.totalCents,
      seed.method,
      seed.source ?? 'pos',
      seed.voided ? seed.createdAtUtc : null,
      seed.voided ? 'error' : null,
    )
    .first<{ id: number }>();
  await env.DB.batch(
    seed.items.map((i) =>
      env.DB.prepare(
        `INSERT INTO sale_items (sale_id, name, size_label, unit_price_cents, quantity, line_total_cents)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(sale!.id, i.name, i.sizeLabel, i.unitCents, i.quantity, i.unitCents * i.quantity),
    ),
  );
}

async function insertExpense(date: string, cents: number, categoryId: number, deleted = false): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO expenses (date, amount_cents, category_id, payment_method, deleted_at)
     VALUES (?, ?, ?, 'efectivo', ?)`,
  )
    .bind(date, cents, categoryId, deleted ? '2026-03-12 10:00:00' : null)
    .run();
}

async function categoryId(name: string): Promise<number> {
  const row = await env.DB.prepare('SELECT id FROM expense_categories WHERE name = ?').bind(name).first<{ id: number }>();
  return row!.id;
}

const pizza = { name: 'Pizza Pepperoni', sizeLabel: 'Grande', unitCents: 3000, quantity: 1 };

async function seedReportData(): Promise<void> {
  const session = await env.DB.prepare(
    "INSERT INTO cash_sessions (opened_at, closed_at, source) VALUES ('2026-03-09 13:00:00', '2026-03-12 13:00:00', 'pos') RETURNING id",
  ).first<{ id: number }>();
  sessionId = session!.id;

  await insertSale({ createdAtUtc: '2026-03-10 17:00:00', totalCents: 3000, method: 'efectivo', items: [pizza] });
  await insertSale({
    createdAtUtc: '2026-03-11 04:30:00',
    totalCents: 2000,
    method: 'yape',
    items: [{ name: 'Gaseosa', sizeLabel: null, unitCents: 1000, quantity: 2 }],
  });
  await insertSale({ createdAtUtc: '2026-03-11 05:30:00', totalCents: 3000, method: 'efectivo', items: [pizza] });
  await insertSale({
    createdAtUtc: '2026-03-11 15:00:00',
    totalCents: 99_999,
    method: 'efectivo',
    voided: true,
    items: [{ name: 'Anulada', sizeLabel: null, unitCents: 99_999, quantity: 1 }],
  });
  await insertSale({
    createdAtUtc: '2026-03-10 17:00:00',
    totalCents: 50_000,
    method: 'efectivo',
    source: 'homebank',
    items: [{ name: 'Venta del día (resumen)', sizeLabel: null, unitCents: 50_000, quantity: 1 }],
  });
  await insertSale({
    createdAtUtc: '2026-03-09 17:00:00',
    totalCents: 10_000,
    method: 'efectivo',
    items: [{ ...pizza, unitCents: 10_000 }],
  });

  const insumos = await categoryId('Insumos');
  const queso = await env.DB.prepare("INSERT INTO expense_categories (name, parent_id) VALUES ('Queso', ?) RETURNING id")
    .bind(insumos)
    .first<{ id: number }>();
  await insertExpense('2026-03-10', 4000, insumos);
  await insertExpense('2026-03-11', 1500, queso!.id);
  await insertExpense('2026-03-11', 700, await categoryId('Gas'));
  await insertExpense('2026-03-10', 88_888, insumos, true); // borrado: no cuenta
  await insertExpense('2026-03-09', 700, await categoryId('Gas')); // período anterior
}

describe('routes/reports (negocio)', () => {
  let owner: TestUser;
  let admin: TestUser;
  let cashier: TestUser;

  beforeAll(async () => {
    owner = await createUser('rep-owner@test.local', 'owner');
    admin = await createUser('rep-admin@test.local', 'admin');
    cashier = await createUser('rep-cashier@test.local', 'cashier');
    await seedReportData();
  });

  describe('acceso', () => {
    const paths = [
      '/reports/summary',
      '/reports/timeseries',
      '/reports/top-products',
      '/reports/sales-by-hour',
      '/reports/sales-by-weekday',
      '/reports/expenses-by-category',
      '/reports/sales-by-payment',
    ];

    it.each(paths)('%s: anónimo 401, cajero 403, admin y owner 200', async (path) => {
      expect((await api(`${path}?${RANGE}`)).status).toBe(401);
      expect((await api(`${path}?${RANGE}`, { token: cashier.token })).status).toBe(403);
      expect((await api(`${path}?${RANGE}`, { token: admin.token })).status).toBe(200);
      expect((await api(`${path}?${RANGE}`, { token: owner.token })).status).toBe(200);
    });

    it.each(paths)('%s valida el rango (400)', async (path) => {
      const invalid = ['from=2026-02-30', 'to=ayer', 'from=2026-03-12&to=2026-03-10', 'from=2000-01-01&to=2026-03-10'];
      for (const qs of invalid) {
        expect((await api(`${path}?${qs}`, { token: owner.token })).status, qs).toBe(400);
      }
    });
  });

  describe('GET /summary', () => {
    it('suma solo ventas no anuladas y gastos no borrados en hora Lima', async () => {
      const res = await api<ReportSummary>(`/reports/summary?${RANGE}`, { token: owner.token });
      expect(res.status).toBe(200);
      expect(res.body.range).toEqual({ from: '2026-03-10', to: '2026-03-11' });
      expect(res.body.current).toEqual({
        incomeCents: 58_000,
        expensesCents: 6200,
        profitCents: 51_800,
        salesCount: 3,
        averageTicketCents: 2667, // 8000 / 3 tickets reales (sin el resumen de HomeBank)
      });
      expect(res.body.summaryIncomeCents).toBe(50_000);
    });

    it('compara contra el período anterior de igual largo', async () => {
      const res = await api<ReportSummary>(`/reports/summary?${RANGE}`, { token: owner.token });
      expect(res.body.previousRange).toEqual({ from: '2026-03-08', to: '2026-03-09' });
      expect(res.body.previous).toEqual({
        incomeCents: 10_000,
        expensesCents: 700,
        profitCents: 9300,
        salesCount: 1,
        averageTicketCents: 10_000,
      });
      expect(res.body.deltaPct.income).toBe(480);
      expect(res.body.deltaPct.expenses).toBe(785.7);
      expect(res.body.deltaPct.salesCount).toBe(200);
    });

    it('rango vacío: ceros, ticket null y deltas null (sin base de comparación)', async () => {
      const empty = await api<ReportSummary>('/reports/summary?from=2026-06-01&to=2026-06-30', { token: owner.token });
      expect(empty.body.current).toEqual({
        incomeCents: 0,
        expensesCents: 0,
        profitCents: 0,
        salesCount: 0,
        averageTicketCents: null,
      });
      expect(empty.body.deltaPct).toEqual({
        income: null,
        expenses: null,
        profit: null,
        salesCount: null,
        averageTicket: null,
      });
    });

    it('sin from/to usa el mes en curso (200)', async () => {
      expect((await api('/reports/summary', { token: owner.token })).status).toBe(200);
    });
  });

  describe('GET /timeseries', () => {
    it('agrupa por día Lima: la venta de 23:30 queda en el día 10', async () => {
      const res = await api<TimeseriesReport>(`/reports/timeseries?${RANGE}&granularity=day`, { token: owner.token });
      expect(res.body.points).toEqual([
        { bucket: '2026-03-10', incomeCents: 55_000, expensesCents: 4000 },
        { bucket: '2026-03-11', incomeCents: 3000, expensesCents: 2200 },
      ]);
    });

    it('rellena días sin movimiento con cero', async () => {
      const res = await api<TimeseriesReport>('/reports/timeseries?from=2026-03-07&to=2026-03-09', {
        token: owner.token,
      });
      expect(res.body.points).toEqual([
        { bucket: '2026-03-07', incomeCents: 0, expensesCents: 0 },
        { bucket: '2026-03-08', incomeCents: 0, expensesCents: 0 },
        { bucket: '2026-03-09', incomeCents: 10_000, expensesCents: 700 },
      ]);
    });

    it('agrupa por semana (lunes) y por mes', async () => {
      const week = await api<TimeseriesReport>(`/reports/timeseries?${RANGE}&granularity=week`, { token: owner.token });
      expect(week.body.points).toEqual([{ bucket: '2026-03-09', incomeCents: 58_000, expensesCents: 6200 }]);
      const month = await api<TimeseriesReport>('/reports/timeseries?from=2026-02-20&to=2026-03-31&granularity=month', {
        token: owner.token,
      });
      expect(month.body.points).toEqual([
        { bucket: '2026-02-01', incomeCents: 0, expensesCents: 0 },
        { bucket: '2026-03-01', incomeCents: 68_000, expensesCents: 6900 },
      ]);
    });

    it('rechaza granularidad inválida (400)', async () => {
      expect((await api(`/reports/timeseries?${RANGE}&granularity=hora`, { token: owner.token })).status).toBe(400);
    });
  });

  describe('GET /top-products', () => {
    it('agrupa por nombre+tamaño, excluye anuladas y HomeBank', async () => {
      const res = await api<TopProductsReport>(`/reports/top-products?${RANGE}`, { token: owner.token });
      expect(res.body.byQuantity).toEqual([
        { name: 'Pizza Pepperoni', sizeLabel: 'Grande', quantity: 2, totalCents: 6000 },
        { name: 'Gaseosa', sizeLabel: null, quantity: 2, totalCents: 2000 },
      ]);
      expect(res.body.byAmount.map((p) => p.name)).toEqual(['Pizza Pepperoni', 'Gaseosa']);
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain('resumen');
      expect(raw).not.toContain('Anulada');
    });

    it('respeta limit y lo valida', async () => {
      const res = await api<TopProductsReport>(`/reports/top-products?${RANGE}&limit=1`, { token: owner.token });
      expect(res.body.byQuantity).toHaveLength(1);
      expect((await api(`/reports/top-products?${RANGE}&limit=0`, { token: owner.token })).status).toBe(400);
      expect((await api(`/reports/top-products?${RANGE}&limit=500`, { token: owner.token })).status).toBe(400);
    });
  });

  describe('GET /sales-by-hour y /sales-by-weekday', () => {
    it('24 horas Lima con ceros; excluye HomeBank y lo informa', async () => {
      const res = await api<SalesDistributionReport<SalesByHourRow>>(`/reports/sales-by-hour?${RANGE}`, {
        token: owner.token,
      });
      expect(res.body.rows).toHaveLength(24);
      expect(res.body.rows[0]).toEqual({ hour: 0, salesCount: 1, totalCents: 3000 });
      expect(res.body.rows[12]).toEqual({ hour: 12, salesCount: 1, totalCents: 3000 });
      expect(res.body.rows[23]).toEqual({ hour: 23, salesCount: 1, totalCents: 2000 });
      expect(res.body.rows[17]).toEqual({ hour: 17, salesCount: 0, totalCents: 0 });
      expect(res.body.excludedSummaryCents).toBe(50_000);
    });

    it('7 días ISO (lunes=1) en hora Lima', async () => {
      const res = await api<SalesDistributionReport<SalesByWeekdayRow>>(`/reports/sales-by-weekday?${RANGE}`, {
        token: owner.token,
      });
      expect(res.body.rows.map((r) => r.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(res.body.rows[1]).toEqual({ weekday: 2, salesCount: 2, totalCents: 5000 }); // martes 10/03
      expect(res.body.rows[2]).toEqual({ weekday: 3, salesCount: 1, totalCents: 3000 }); // miércoles 11/03
      expect(res.body.rows[0]).toEqual({ weekday: 1, salesCount: 0, totalCents: 0 });
    });
  });

  describe('GET /expenses-by-category', () => {
    it('agrega hijas en su padre y no cuenta borrados', async () => {
      const res = await api<ExpensesByCategoryReport>(`/reports/expenses-by-category?${RANGE}`, { token: owner.token });
      expect(res.body.totalCents).toBe(6200);
      expect(res.body.rows.map((r) => [r.name, r.totalCents, r.directCents])).toEqual([
        ['Insumos', 5500, 4000],
        ['Gas', 700, 700],
      ]);
      expect(res.body.rows[0]!.children).toEqual([expect.objectContaining({ name: 'Queso', totalCents: 1500 })]);
      expect(res.body.rows[1]!.children).toEqual([]);
    });
  });

  describe('GET /sales-by-payment', () => {
    it('agrupa por método, solo ventas reales no anuladas', async () => {
      const res = await api<SalesDistributionReport<SalesByPaymentRow>>(`/reports/sales-by-payment?${RANGE}`, {
        token: owner.token,
      });
      expect(res.body.rows).toEqual([
        { paymentMethod: 'efectivo', label: 'Efectivo', salesCount: 2, totalCents: 6000 },
        { paymentMethod: 'yape', label: 'Yape', salesCount: 1, totalCents: 2000 },
      ]);
      expect(res.body.excludedSummaryCents).toBe(50_000);
    });
  });
});
