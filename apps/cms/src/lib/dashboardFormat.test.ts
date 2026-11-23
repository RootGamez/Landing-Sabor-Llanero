import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { niceTicksRange, periodFromParams, periodToParams, PERIOD_OPTIONS } from './dashboardFormat';
import { buildChartRows } from '../components/dashboard/timeseriesRows';

describe('periodFromParams', () => {
  const today = '2026-11-23';

  it('sin parámetros usa "Este mes"', () => {
    const result = periodFromParams(new URLSearchParams(''), today);
    assert.deepEqual(result, { key: 'mes', range: { from: '2026-11-01', to: '2026-11-23' } });
  });

  it('resuelve los atajos nuevos (ayer, 30 días) y los ofrece en el selector', () => {
    assert.deepEqual(periodFromParams(new URLSearchParams('p=ayer'), today).range, { from: '2026-11-22', to: '2026-11-22' });
    assert.deepEqual(periodFromParams(new URLSearchParams('p=30d'), today).range, { from: '2026-10-25', to: '2026-11-23' });
    const keys = PERIOD_OPTIONS.map((o) => o.key);
    assert.deepEqual(keys, ['hoy', 'ayer', '7d', '30d', 'mes', 'mes-pasado', 'anio', 'personalizado']);
  });

  it('un rango personalizado válido viaja en la URL; uno inválido cae al mes', () => {
    const custom = periodFromParams(new URLSearchParams('p=personalizado&from=2026-10-01&to=2026-10-15'), today);
    assert.deepEqual(custom, { key: 'personalizado', range: { from: '2026-10-01', to: '2026-10-15' } });
    assert.deepEqual(periodToParams('personalizado', custom.range), { p: 'personalizado', from: '2026-10-01', to: '2026-10-15' });
    assert.equal(periodFromParams(new URLSearchParams('p=personalizado&from=2026-10-20&to=2026-10-15'), today).key, 'mes');
    assert.equal(periodFromParams(new URLSearchParams('p=hackeado'), today).key, 'mes');
  });
});

describe('niceTicksRange', () => {
  it('sin negativos equivale a ticks de 0 al máximo', () => {
    const ticks = niceTicksRange(0, 9500, 4);
    assert.equal(ticks[0], 0);
    assert.ok(ticks[ticks.length - 1]! >= 9500);
  });

  it('con negativos incluye el cero y cubre el mínimo y el máximo', () => {
    const ticks = niceTicksRange(-3000, 8000, 4);
    assert.ok(ticks.includes(0));
    assert.ok(ticks[0]! <= -3000);
    assert.ok(ticks[ticks.length - 1]! >= 8000);
  });
});

describe('buildChartRows', () => {
  const points = [
    { bucket: '2026-11-22', incomeCents: 1000, expensesCents: 400 },
    { bucket: '2026-11-23', incomeCents: 500, expensesCents: 700 },
  ];

  it('calcula la ganancia neta por período', () => {
    const { rows } = buildChartRows(points, []);
    assert.deepEqual(rows.map((r) => r.netCents), [600, -200]);
  });

  it('agrega solo los días proyectados posteriores al último real y guarda hoy para la línea punteada', () => {
    const projection = [
      { day: '2026-11-23', incomeCents: 2000 },
      { day: '2026-11-24', incomeCents: 1800 },
    ];
    const { rows, lastActualIndex, projectedByIndex } = buildChartRows(points, projection);
    assert.equal(rows.length, 3);
    assert.equal(rows[2]!.isProjected, true);
    assert.equal(lastActualIndex, 1);
    assert.deepEqual([...projectedByIndex.entries()], [[1, 2000], [2, 1800]]);
  });
});
