import { describe, expect, it } from 'vitest';
import { projectMonthEnd, type DailyIncome } from './reportProjection';
import { marginPct } from './reportMath';

/** Noviembre 2026: el 1 es domingo. `fn(day)` da lo vendido ese día (1-based). */
function november(upTo: number, fn: (dayOfMonth: number) => number): DailyIncome[] {
  return Array.from({ length: upTo }, (_, i) => ({
    day: `2026-11-${String(i + 1).padStart(2, '0')}`,
    incomeCents: fn(i + 1),
  }));
}

describe('projectMonthEnd', () => {
  it('con pocos días completos dice que los datos son insuficientes', () => {
    const result = projectMonthEnd(november(5, () => 10_000), '2026-11-05');
    expect(result).toEqual({ status: 'insufficient', observedDays: 4, minDays: 7 });
  });

  it('con ritmo constante y menos de dos semanas usa el promedio diario', () => {
    // Días 1-9 completos (hoy = 10): 9 días × 10 000 = 90 000. Quedan 10 a 30 = 21 días + hoy.
    const result = projectMonthEnd(november(9, () => 10_000), '2026-11-10');
    if (result.status !== 'ok') throw new Error('se esperaba ok');
    expect(result.method).toBe('average');
    expect(result.actualCents).toBe(90_000);
    expect(result.days).toHaveLength(21);
    expect(result.projectedCents).toBe(90_000 + 21 * 10_000);
    expect(result.lowCents).toBe(result.projectedCents); // sin variación no hay rango
    expect(result.highCents).toBe(result.projectedCents);
  });

  it('con dos semanas o más aplica la estacionalidad por día de la semana', () => {
    // Domingos (1, 8, 15) venden 30 000; el resto 10 000. Hoy = lunes 16 (sin ventas aún).
    const isSunday = (d: number) => (d - 1) % 7 === 0;
    const result = projectMonthEnd(november(15, (d) => (isSunday(d) ? 30_000 : 10_000)), '2026-11-16');
    if (result.status !== 'ok') throw new Error('se esperaba ok');
    expect(result.method).toBe('weekday');
    // Días 16-30: domingos 22 y 29 → 2 × 30 000; los otros 13 días × 10 000.
    const remaining = 2 * 30_000 + 13 * 10_000;
    expect(result.projectedCents).toBe(result.actualCents + remaining);
    expect(result.days.find((d) => d.day === '2026-11-22')?.incomeCents).toBe(30_000);
    expect(result.remainingDays).toBe(14);
  });

  it('hoy cuenta lo ya vendido si supera lo esperado', () => {
    const daily = [...november(9, () => 10_000), { day: '2026-11-10', incomeCents: 50_000 }];
    const result = projectMonthEnd(daily, '2026-11-10');
    if (result.status !== 'ok') throw new Error('se esperaba ok');
    expect(result.actualCents).toBe(140_000);
    expect(result.projectedCents).toBe(140_000 + 20 * 10_000);
  });

  it('los días sin ventas cuentan como 0 y el rango nunca baja de lo ya vendido', () => {
    const daily = november(9, (d) => (d % 2 === 0 ? 0 : 20_000)).filter((d) => d.incomeCents > 0);
    const result = projectMonthEnd(daily, '2026-11-10');
    if (result.status !== 'ok') throw new Error('se esperaba ok');
    expect(result.observedDays).toBe(9);
    expect(result.lowCents).toBeGreaterThanOrEqual(result.actualCents);
    expect(result.highCents).toBeGreaterThan(result.projectedCents);
  });

  it('el último día del mes proyecta solo hoy', () => {
    const result = projectMonthEnd(november(29, () => 10_000), '2026-11-30');
    if (result.status !== 'ok') throw new Error('se esperaba ok');
    expect(result.days).toHaveLength(1);
    expect(result.remainingDays).toBe(0);
  });
});

describe('marginPct', () => {
  it('calcula el margen con un decimal', () => {
    expect(marginPct(250, 1000)).toBe(25);
    expect(marginPct(1, 3)).toBe(33.3);
    expect(marginPct(-500, 1000)).toBe(-50);
  });

  it('devuelve null sin ingresos', () => {
    expect(marginPct(-500, 0)).toBeNull();
  });
});
