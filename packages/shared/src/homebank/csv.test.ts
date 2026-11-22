import { describe, expect, it } from 'vitest';
import { parseHomebankCsv, paymentCodeToMethod } from './csv';
import { MAX_HOMEBANK_INPUT_CHARS, MAX_HOMEBANK_ROWS } from './limits';

const HEADER = 'date;payment;info;payee;memo;amount;category;tags';

describe('paymentCodeToMethod', () => {
  it.each([
    [3, 'efectivo'],
    [1, 'tarjeta'],
    [6, 'tarjeta'],
    [4, 'transferencia'],
    [5, 'transferencia'],
    [7, 'transferencia'],
    [8, 'transferencia'],
    [9, 'transferencia'],
    [0, 'efectivo'],
    [2, 'efectivo'],
    [10, 'efectivo'],
    [99, 'efectivo'],
  ])('código %s -> %s', (code, method) => {
    expect(paymentCodeToMethod(code)).toBe(method);
  });
});

describe('parseHomebankCsv', () => {
  it('parsea con encabezado', () => {
    const csv = `${HEADER}\n2025-05-25;3;F001;Proveedor;Pollo;-125.50;Compras:Insumos;frio`;
    const { rows, errors } = parseHomebankCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        date: '2025-05-25',
        amountCents: -12550,
        category: 'Compras:Insumos',
        payee: 'Proveedor',
        memo: 'Pollo',
        info: 'F001',
        tags: 'frio',
        paymentMethod: 'efectivo',
      },
    ]);
  });

  it('parsea sin encabezado, con BOM y CRLF', () => {
    const csv = `﻿2025-05-25;6;;P;M;10;Ventas;\r\n2025-05-26;4;;P;M;20;Ventas;\r\n`;
    const { rows, errors } = parseHomebankCsv(csv);
    expect(errors).toEqual([]);
    expect(rows.map((r) => [r.date, r.paymentMethod, r.amountCents])).toEqual([
      ['2025-05-25', 'tarjeta', 1000],
      ['2025-05-26', 'transferencia', 2000],
    ]);
  });

  it('acepta columnas finales omitidas (categoría y tags)', () => {
    const { rows, errors } = parseHomebankCsv('2025-05-25;3;;P;M;7');
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ category: '', tags: '', amountCents: 700 });
  });

  it('respeta comillas, punto y coma y comillas dobles escapadas dentro del campo', () => {
    const csv = `2025-05-25;3;;"Pepe; ""el"" mayorista";"línea 1\nlínea 2";-5;Compras;`;
    const { rows, errors } = parseHomebankCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]?.payee).toBe('Pepe; "el" mayorista');
    expect(rows[0]?.memo).toBe('línea 1\nlínea 2');
  });

  it.each([
    ['12.5', 1250],
    ['12,5', 1250],
    ['-1.234,56', -123456],
    ['1,234.56', 123456],
    ['+3', 300],
    ['-0,05', -5],
    ['0', 0],
    [' 8 ', 800],
  ])('monto %s -> %s céntimos', (raw, cents) => {
    const { rows, errors } = parseHomebankCsv(`2025-05-25;3;;P;M;${raw};C;`);
    expect(errors).toEqual([]);
    expect(rows[0]?.amountCents).toBe(cents);
  });

  it.each(['abc', '', '1,234', '1.2.3', '12.345', '--5'])('monto inválido "%s" es error de fila', (raw) => {
    const { rows, errors } = parseHomebankCsv(`2025-05-25;3;;P;M;${raw};C;`);
    expect(rows).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toMatch(/monto/i);
  });

  describe('fechas', () => {
    const dateOf = (raw: string, options?: Parameters<typeof parseHomebankCsv>[1]) =>
      parseHomebankCsv(`${raw};3;;P;M;1;C;`, options);

    it.each([
      ['25/05/2025', '2025-05-25'],
      ['25-05-25', '2025-05-25'],
      ['31/12/99', '2099-12-31'],
      ['05/05/2025', '2025-05-05'],
    ])('detecta DD/MM sin ambigüedad: %s', (raw, iso) => {
      expect(dateOf(raw).rows[0]?.date).toBe(iso);
    });

    it('fecha ISO funciona siempre', () => {
      expect(dateOf('2025-05-25').rows[0]?.date).toBe('2025-05-25');
    });

    it('día/mes ambiguo sin dateFormat es error claro de fila', () => {
      const { rows, errors } = dateOf('01/02/25');
      expect(rows).toEqual([]);
      expect(errors).toEqual([{ line: 1, message: expect.stringContaining('ambigua') }]);
    });

    it('MM/DD sin dateFormat explícito es error', () => {
      const { rows, errors } = dateOf('12/25/25');
      expect(rows).toEqual([]);
      expect(errors[0]?.message).toContain('dateFormat');
    });

    it('con dateFormat explícito resuelve la ambigüedad', () => {
      expect(dateOf('01/02/25', { dateFormat: 'DD/MM' }).rows[0]?.date).toBe('2025-02-01');
      expect(dateOf('01/02/25', { dateFormat: 'MM/DD' }).rows[0]?.date).toBe('2025-01-02');
      expect(dateOf('12/25/2025', { dateFormat: 'MM/DD' }).rows[0]?.date).toBe('2025-12-25');
    });

    it.each(['31/02/2025', '2025-13-01', '2025-02-30', 'ayer', '', '1/1', '25/05/202'])(
      'fecha inválida "%s" es error de fila',
      (raw) => {
        const { rows, errors } = dateOf(raw, { dateFormat: 'DD/MM' });
        expect(rows).toEqual([]);
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toMatch(/fecha/i);
      },
    );

    it('29 de febrero respeta años bisiestos', () => {
      expect(dateOf('29/02/2024').rows[0]?.date).toBe('2024-02-29');
      expect(dateOf('29/02/2025').rows).toEqual([]);
    });
  });

  it('filas rotas no tumban las buenas y reportan número de línea real', () => {
    const csv = [HEADER, '2025-05-25;3;;P;M;1;C;', 'basura', '', '2025-05-26;3;;P;M;2;C;', '2025-05-27;3;;P;M;zz;C;'].join(
      '\n',
    );
    const { rows, errors } = parseHomebankCsv(csv);
    expect(rows.map((r) => r.amountCents)).toEqual([100, 200]);
    expect(errors.map((e) => e.line)).toEqual([3, 6]);
  });

  it('código de pago no numérico o fuera de rango cae en efectivo', () => {
    const csv = '2025-05-25;x;;P;M;1;C;\n2025-05-25;77;;P;M;1;C;';
    expect(parseHomebankCsv(csv).rows.map((r) => r.paymentMethod)).toEqual(['efectivo', 'efectivo']);
  });

  it('normaliza NFC y recorta espacios', () => {
    const decomposed = 'Café';
    const { rows } = parseHomebankCsv(`2025-05-25;3;;  ${decomposed} ;M;1;C;`);
    expect(rows[0]?.payee).toBe('Café');
  });

  it('error global por tamaño o por cantidad de filas', () => {
    const big = parseHomebankCsv('x'.repeat(MAX_HOMEBANK_INPUT_CHARS + 1));
    expect(big.errors).toEqual([{ line: 0, message: expect.stringContaining('tamaño') }]);
    const many = parseHomebankCsv('2025-05-25;3;;P;M;1;C;\n'.repeat(MAX_HOMEBANK_ROWS + 1));
    expect(many.rows).toEqual([]);
    expect(many.errors).toEqual([{ line: 0, message: expect.stringContaining('filas') }]);
  });

  it('texto vacío o solo encabezado devuelve resultado vacío', () => {
    expect(parseHomebankCsv('')).toEqual({ rows: [], errors: [] });
    expect(parseHomebankCsv(HEADER)).toEqual({ rows: [], errors: [] });
  });

  it('comilla sin cerrar es error de fila, no excepción', () => {
    const { errors } = parseHomebankCsv('2025-05-25;3;;"P;M;1;C;');
    expect(errors.length).toBeGreaterThan(0);
  });
});
