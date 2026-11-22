import { describe, expect, it } from 'vitest';
import { formatPrice } from './format';
import { MAX_CENTS, formatPEN, fromCents, toCents } from './money';

describe('toCents', () => {
  it.each([
    [0, 0],
    [25, 2500],
    [25.5, 2550],
    [0.01, 1],
    [1234.5, 123450],
  ])('convierte %s soles a %s céntimos', (soles, cents) => {
    expect(toCents(soles)).toBe(cents);
  });

  it('es robusto a la suma de floats (0.1 + 0.2 = 30 céntimos, no 30.000000000000004)', () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it('redondea half-up de forma estable aunque el float quede apenas por debajo (1.005 → 101)', () => {
    expect(toCents(1.005)).toBe(101);
    expect(toCents(2.675)).toBe(268);
  });

  it('redondea a céntimo entero cuando hay más de 2 decimales', () => {
    expect(toCents(10.994)).toBe(1099);
    expect(toCents(10.996)).toBe(1100);
  });

  it('acumula sin deriva: sumar 0.1 diez veces equivale a 1 sol', () => {
    const total = Array.from({ length: 10 }, () => 0.1).reduce((a, b) => a + b, 0);
    expect(toCents(total)).toBe(100);
  });

  it.each([-1, -0.01, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rechaza %s (negativo o no finito)',
    (value) => {
      expect(() => toCents(value)).toThrow(RangeError);
    },
  );

  it('rechaza montos que superan MAX_CENTS', () => {
    expect(() => toCents(MAX_CENTS / 100 + 1)).toThrow(RangeError);
  });
});

describe('fromCents', () => {
  it('convierte céntimos enteros a soles', () => {
    expect(fromCents(2550)).toBe(25.5);
    expect(fromCents(1)).toBe(0.01);
    expect(fromCents(0)).toBe(0);
  });

  it('acepta negativos (diferencias de caja: sobrante/faltante)', () => {
    expect(fromCents(-250)).toBe(-2.5);
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])('rechaza %s (no es entero)', (value) => {
    expect(() => fromCents(value)).toThrow(RangeError);
  });

  it('es la inversa de toCents para montos con 2 decimales', () => {
    for (const cents of [0, 1, 99, 100, 12345, 99999999]) {
      expect(toCents(fromCents(cents))).toBe(cents);
    }
  });
});

describe('formatPEN', () => {
  it('reutiliza el formato de formatPrice (sin duplicar la lógica de moneda)', () => {
    expect(formatPEN(123450)).toBe(formatPrice(1234.5));
    expect(formatPEN(2500)).toBe(formatPrice(25));
  });

  it('muestra símbolo de soles y dos decimales', () => {
    expect(formatPEN(2500)).toMatch(/^S\/\s?25\.00$/);
  });

  it('formatea negativos para diferencias de caja', () => {
    expect(formatPEN(-250)).toContain('2.50');
  });
});
