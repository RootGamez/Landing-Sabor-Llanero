import { useMemo } from 'react';
import {
  projectMonthEnd,
  resolveQuickPeriod,
  todayLocal,
  type MonthProjection,
  type ReportRange,
} from '@sabor/shared';
import { fetchSummary, fetchTimeseries } from '../lib/reportsApi';
import { useAsync } from './useAsync';

/** La proyección solo tiene sentido para el mes en curso visto "del día 1 a hoy". */
export function isMonthToDate(range: ReportRange, today: string): boolean {
  const current = resolveQuickPeriod('mes', today);
  return range.from === current.from && range.to === current.to;
}

export interface MonthProjectionState {
  enabled: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  projection: MonthProjection | undefined;
  /** Ingresos del mes pasado completo (para "vs. mes pasado"). */
  lastMonthIncomeCents: number | undefined;
}

/**
 * Carga lo vendido por día del mes en curso y el total del mes pasado, y
 * calcula la proyección al cierre. No hace nada (ni pide datos) fuera del
 * mes en curso.
 */
export function useMonthProjection(range: ReportRange): MonthProjectionState {
  const today = todayLocal();
  const enabled = isMonthToDate(range, today);
  const lastMonth = resolveQuickPeriod('mes-pasado', today);

  const daily = useAsync(
    () => (enabled ? fetchTimeseries(range, 'day') : Promise.resolve(undefined)),
    [enabled, range.from, range.to],
  );
  const previous = useAsync(
    () => (enabled ? fetchSummary(lastMonth) : Promise.resolve(undefined)),
    [enabled, lastMonth.from, lastMonth.to],
  );

  const projection = useMemo(
    () =>
      daily.data
        ? projectMonthEnd(
            daily.data.points.map((p) => ({ day: p.bucket, incomeCents: p.incomeCents })),
            today,
          )
        : undefined,
    [daily.data, today],
  );

  return {
    enabled,
    loading: daily.loading || previous.loading,
    error: daily.error ?? previous.error,
    refetch: () => {
      daily.refetch();
      previous.refetch();
    },
    projection,
    lastMonthIncomeCents: previous.data?.current.incomeCents,
  };
}
