import { describe, expect, it } from 'vitest';
import { localRangeDays } from '@sabor/shared';
import { bucketStart, enumerateBuckets, previousRange, utcWindow } from './report-range';

describe('report-range', () => {
  it('cuenta días inclusivos y calcula el período anterior de igual largo', () => {
    expect(localRangeDays({ from: '2026-03-01', to: '2026-03-31' })).toBe(31);
    expect(previousRange({ from: '2026-03-01', to: '2026-03-31' })).toEqual({ from: '2026-01-29', to: '2026-02-28' });
    expect(previousRange({ from: '2026-03-10', to: '2026-03-10' })).toEqual({ from: '2026-03-09', to: '2026-03-09' });
  });

  it('el bucket semanal arranca en lunes y el mensual el día 1', () => {
    expect(bucketStart('2026-03-08', 'week')).toBe('2026-03-02'); // domingo → lunes anterior
    expect(bucketStart('2026-03-02', 'week')).toBe('2026-03-02');
    expect(bucketStart('2026-03-31', 'month')).toBe('2026-03-01');
  });

  it('enumera buckets sin huecos', () => {
    expect(enumerateBuckets({ from: '2026-03-30', to: '2026-04-02' }, 'day')).toHaveLength(4);
    expect(enumerateBuckets({ from: '2026-03-04', to: '2026-03-18' }, 'week')).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
    ]);
    expect(enumerateBuckets({ from: '2025-11-15', to: '2026-02-01' }, 'month')).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
    ]);
  });

  it('la ventana UTC de un día local de Lima empieza a las 05:00 UTC', () => {
    expect(utcWindow({ from: '2026-03-10', to: '2026-03-11' })).toEqual({
      fromUtc: '2026-03-10 05:00:00',
      toUtc: '2026-03-12 05:00:00',
    });
  });
});
