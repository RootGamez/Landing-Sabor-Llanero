import { describe, expect, it } from 'vitest';
import { classifyRows } from './classify';
import { importHash, importHashes } from './hash';
import { parseHomebankCsv } from './csv';
import { parseXhb } from './xhb';
import type { HomebankRow } from './types';

const row = (overrides: Partial<HomebankRow> = {}): HomebankRow => ({
  date: '2025-05-25',
  amountCents: -1000,
  category: 'Compras',
  payee: 'Proveedor',
  memo: 'Pollo',
  info: '',
  tags: '',
  paymentMethod: 'efectivo',
  ...overrides,
});

describe('classifyRows', () => {
  it('negativos son gastos con monto positivo y descripción payee — memo', () => {
    const { expenses, incomes, ignored } = classifyRows([row()]);
    expect(incomes).toEqual([]);
    expect(ignored).toBe(0);
    expect(expenses).toEqual([
      {
        date: '2025-05-25',
        amountCents: 1000,
        category: 'Compras',
        description: 'Proveedor — Pollo',
        paymentMethod: 'efectivo',
      },
    ]);
  });

  it('omite partes vacías y la marca "Importación automática" (con o sin tilde/mayúsculas)', () => {
    const { expenses } = classifyRows([
      row({ memo: 'Importación automática' }),
      row({ memo: 'IMPORTACION AUTOMATICA', payee: '' }),
      row({ payee: '', memo: 'Solo memo' }),
      row({ payee: '', memo: '' }),
    ]);
    expect(expenses.map((e) => e.description)).toEqual(['Proveedor', '', 'Solo memo', '']);
  });

  it('positivos son ingresos (venta resumen) solo con fecha y monto', () => {
    const { expenses, incomes } = classifyRows([row({ amountCents: 48010, date: '2025-05-26' })]);
    expect(expenses).toEqual([]);
    expect(incomes).toEqual([{ date: '2025-05-26', amountCents: 48010 }]);
  });

  it('cero se ignora y se cuenta', () => {
    const result = classifyRows([row({ amountCents: 0 })]);
    expect(result).toEqual({ expenses: [], incomes: [], ignored: 1 });
  });

  it('no muta la entrada y conserva el orden', () => {
    const input = Object.freeze([row({ amountCents: -1 }), row({ amountCents: -2 })]);
    expect(classifyRows(input).expenses.map((e) => e.amountCents)).toEqual([1, 2]);
  });
});

describe('importHash', () => {
  it('es hex SHA-256 de 64 caracteres y determinista', async () => {
    const a = await importHash(row());
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await importHash(row())).toBe(a);
  });

  it('ignora info/tags/paymentMethod pero distingue los campos que lo componen', async () => {
    const base = await importHash(row());
    expect(await importHash(row({ info: 'x', tags: 'y', paymentMethod: 'tarjeta' }))).toBe(base);
    for (const change of [
      { date: '2025-05-26' },
      { amountCents: -1001 },
      { payee: 'Otro' },
      { memo: 'Otro' },
      { category: 'Otra' },
    ]) {
      expect(await importHash(row(change))).not.toBe(base);
    }
  });

  it('normaliza trim y NFC', async () => {
    const a = await importHash(row({ payee: 'Café' }));
    const b = await importHash(row({ payee: '  Café ' }));
    expect(b).toBe(a);
  });

  it('no confunde campos contiguos (separador seguro)', async () => {
    const a = await importHash(row({ payee: 'a|b', memo: 'c' }));
    const b = await importHash(row({ payee: 'a', memo: 'b|c' }));
    expect(a).not.toBe(b);
  });

  it('es idéntico entre dos parseos del mismo archivo (xhb y csv)', async () => {
    const xhb = '<ope date="739396" amount="-5.5" payee="1"/><pay key="1" name="P"/>';
    const csv = '2025-05-25;3;;P;;-5.5;;';
    const hashes = async (text: string, parse: typeof parseXhb) =>
      Promise.all(parse(text).rows.map(importHash));
    expect(await hashes(xhb, parseXhb)).toEqual(await hashes(xhb, parseXhb));
    expect(await hashes(csv, parseHomebankCsv)).toEqual(await hashes(csv, parseHomebankCsv));
    expect(await hashes(csv, parseHomebankCsv)).toEqual(await hashes(xhb, parseXhb));
  });
});

describe('importHashes', () => {
  it('filas idénticas dentro del mismo archivo reciben hashes distintos y estables', async () => {
    const rows = [row(), row(), row({ memo: 'otro' }), row()];
    const first = await importHashes(rows);
    expect(new Set(first).size).toBe(4);
    expect(first[0]).toBe(await importHash(row()));
    expect(await importHashes(rows)).toEqual(first);
  });
});
