import { describe, expect, it } from 'vitest';
import {
  LIMA_OFFSET_MINUTES,
  isValidLocalDate,
  localDate,
  localDayRangeUtc,
  todayLocal,
} from './localDate';

describe('LIMA_OFFSET_MINUTES', () => {
  it('es UTC-5 fijo (Lima no tiene horario de verano)', () => {
    expect(LIMA_OFFSET_MINUTES).toBe(-300);
  });
});

describe('localDate', () => {
  it('23:59 en Lima sigue siendo el mismo día (04:59 UTC del día siguiente)', () => {
    expect(localDate('2026-11-23T04:59:59Z')).toBe('2026-11-22');
  });

  it('00:00 en Lima ya es el día nuevo (05:00 UTC)', () => {
    expect(localDate('2026-11-23T05:00:00Z')).toBe('2026-11-23');
  });

  it('00:00 UTC cae todavía en el día anterior en Lima', () => {
    expect(localDate('2026-11-23T00:00:00Z')).toBe('2026-11-22');
  });

  it('acepta el formato de SQLite datetime("now") interpretándolo como UTC', () => {
    expect(localDate('2026-11-23 04:59:59')).toBe('2026-11-22');
    expect(localDate('2026-11-23 05:00:00')).toBe('2026-11-23');
  });

  it('acepta un Date', () => {
    expect(localDate(new Date('2026-01-01T03:00:00Z'))).toBe('2025-12-31');
  });

  it('cruza correctamente el fin de año y el 29 de febrero', () => {
    expect(localDate('2027-01-01T04:59:59Z')).toBe('2026-12-31');
    expect(localDate('2028-03-01T04:59:59Z')).toBe('2028-02-29');
  });

  it.each(['', 'ayer', '2026-13-45T00:00:00Z'])('rechaza entrada inválida "%s"', (value) => {
    expect(() => localDate(value)).toThrow(RangeError);
  });

  it('rechaza un Date inválido', () => {
    expect(() => localDate(new Date('nope'))).toThrow(RangeError);
  });
});

describe('localDayRangeUtc', () => {
  it('devuelve [05:00 UTC del día, 05:00 UTC del siguiente) en formato SQLite', () => {
    expect(localDayRangeUtc('2026-11-22')).toEqual({
      fromUtc: '2026-11-22 05:00:00',
      toUtc: '2026-11-23 05:00:00',
    });
  });

  it('cruza fin de mes y de año', () => {
    expect(localDayRangeUtc('2026-12-31').toUtc).toBe('2027-01-01 05:00:00');
    expect(localDayRangeUtc('2028-02-29').toUtc).toBe('2028-03-01 05:00:00');
  });

  it('es consistente con localDate: el borde inferior es incluido y el superior excluido', () => {
    const { fromUtc, toUtc } = localDayRangeUtc('2026-11-22');
    expect(localDate(fromUtc)).toBe('2026-11-22');
    expect(localDate(toUtc)).toBe('2026-11-23');
  });

  it('los rangos de días consecutivos no se solapan ni dejan huecos', () => {
    expect(localDayRangeUtc('2026-11-22').toUtc).toBe(localDayRangeUtc('2026-11-23').fromUtc);
  });

  it.each(['2026-02-30', '2026-13-01', '22-11-2026', '2026-1-1', ''])('rechaza "%s"', (value) => {
    expect(() => localDayRangeUtc(value)).toThrow(RangeError);
  });
});

describe('isValidLocalDate', () => {
  it('valida formato y calendario real', () => {
    expect(isValidLocalDate('2028-02-29')).toBe(true);
    expect(isValidLocalDate('2027-02-29')).toBe(false);
    expect(isValidLocalDate('2026-11-22T10:00')).toBe(false);
  });
});

describe('todayLocal', () => {
  it('usa el reloj inyectado para ser determinista', () => {
    expect(todayLocal(new Date('2026-11-23T04:59:59Z'))).toBe('2026-11-22');
    expect(todayLocal(new Date('2026-11-23T05:00:00Z'))).toBe('2026-11-23');
  });

  it('por defecto devuelve una fecha con formato YYYY-MM-DD', () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
