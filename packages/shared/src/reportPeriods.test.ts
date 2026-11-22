import { describe, expect, it } from 'vitest';
import { autoGranularity, localRangeDays, resolveQuickPeriod } from './reportPeriods';

describe('resolveQuickPeriod', () => {
  const today = '2026-03-15';

  it('resuelve cada período rápido en días locales', () => {
    expect(resolveQuickPeriod('hoy', today)).toEqual({ from: '2026-03-15', to: '2026-03-15' });
    expect(resolveQuickPeriod('7d', today)).toEqual({ from: '2026-03-09', to: '2026-03-15' });
    expect(resolveQuickPeriod('mes', today)).toEqual({ from: '2026-03-01', to: '2026-03-15' });
    expect(resolveQuickPeriod('mes-pasado', today)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(resolveQuickPeriod('anio', today)).toEqual({ from: '2026-01-01', to: '2026-03-15' });
  });

  it('el mes pasado cruza el año en enero y respeta bisiestos', () => {
    expect(resolveQuickPeriod('mes-pasado', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(resolveQuickPeriod('mes-pasado', '2028-03-05')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('autoGranularity', () => {
  it('día hasta un mes, semana hasta ~6 meses, luego mes', () => {
    expect(autoGranularity({ from: '2026-03-01', to: '2026-03-31' })).toBe('day');
    expect(autoGranularity({ from: '2026-01-01', to: '2026-03-15' })).toBe('week');
    expect(autoGranularity({ from: '2026-01-01', to: '2026-11-20' })).toBe('month');
  });

  it('cuenta días inclusivos', () => {
    expect(localRangeDays({ from: '2026-03-10', to: '2026-03-10' })).toBe(1);
    expect(localRangeDays({ from: '2026-03-01', to: '2026-03-31' })).toBe(31);
  });
});
