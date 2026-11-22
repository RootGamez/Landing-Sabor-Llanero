import { describe, expect, it } from 'vitest';
import { chunkHomebankImport, prepareHomebankImport, sanitizeHomebankText } from './prepare';
import type { HomebankRow } from './types';

const row = (patch: Partial<HomebankRow> = {}): HomebankRow => ({
  date: '2026-03-10',
  amountCents: -1_000,
  category: 'Compras',
  payee: 'Sabor Llanero - Compra',
  memo: '',
  info: '',
  tags: '',
  paymentMethod: 'efectivo',
  ...patch,
});

describe('prepareHomebankImport', () => {
  it('clasifica, hashea y totaliza', async () => {
    const result = await prepareHomebankImport([
      row(),
      row({ amountCents: -250, date: '2026-03-01' }),
      row({ amountCents: 30_000, date: '2026-03-12', category: 'Ventas' }),
      row({ amountCents: 0 }),
    ]);
    expect(result.expenses).toHaveLength(2);
    expect(result.incomes).toHaveLength(1);
    expect(result.ignored).toBe(1);
    expect(result.expensesTotalCents).toBe(1_250);
    expect(result.incomesTotalCents).toBe(30_000);
    expect(result.dateRange).toEqual({ from: '2026-03-01', to: '2026-03-12' });
    for (const r of [...result.expenses, ...result.incomes]) expect(r.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('compras idénticas del mismo día tienen hashes distintos y estables', async () => {
    const a = await prepareHomebankImport([row(), row()]);
    const b = await prepareHomebankImport([row(), row()]);
    expect(new Set(a.expenses.map((r) => r.hash)).size).toBe(2);
    expect(a.expenses.map((r) => r.hash)).toEqual(b.expenses.map((r) => r.hash));
  });

  it('sanea caracteres de control y recorta la descripción a 200', async () => {
    const result = await prepareHomebankImport([row({ payee: `Pollo\n\tfresco${'x'.repeat(300)}` })]);
    expect(result.rejected).toEqual([]);
    expect(result.expenses[0]!.description.startsWith('Pollo fresco')).toBe(true);
    expect(result.expenses[0]!.description.length).toBeLessThanOrEqual(200);
  });

  it('rechaza (sin enviar) filas que el servidor no aceptaría', async () => {
    const result = await prepareHomebankImport([row({ amountCents: -100_000_000 }), row({ category: 'c'.repeat(200) })]);
    expect(result.expenses).toHaveLength(0);
    expect(result.rejected.map((r) => r.index)).toEqual([1, 2]);
  });

  it('sin filas: rango nulo', async () => {
    expect((await prepareHomebankImport([])).dateRange).toBeNull();
  });
});

describe('chunkHomebankImport', () => {
  const e = (n: number) => Array.from({ length: n }, (_, i) => ({ i }) as never);
  it('respeta el tope por lote mezclando gastos e ingresos sin perder filas', () => {
    const batches = chunkHomebankImport(e(7), e(6), 5);
    expect(batches.map((b) => b.expenses.length + b.incomes.length)).toEqual([5, 5, 3]);
    expect(batches.reduce((n, b) => n + b.expenses.length, 0)).toBe(7);
    expect(batches.reduce((n, b) => n + b.incomes.length, 0)).toBe(6);
  });
  it('lista vacía → sin lotes', () => {
    expect(chunkHomebankImport([], [], 5)).toEqual([]);
  });
});

describe('sanitizeHomebankText', () => {
  it('colapsa espacios y quita invisibles', () => {
    expect(sanitizeHomebankText('  a\u200bb \n c ')).toBe('a b c');
  });
});
