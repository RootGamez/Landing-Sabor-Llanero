import type { ProjectedDay, TimeseriesPoint } from '@sabor/shared';

/** Fila del gráfico: un período real o un día proyectado (solo ingresos). */
export interface ChartRow {
  bucket: string;
  incomeCents: number;
  expensesCents: number;
  netCents: number;
  isProjected: boolean;
}

export interface ChartRows {
  rows: ChartRow[];
  /** Índice del último período real (hoy, en el mes en curso). */
  lastActualIndex: number;
  /** Ingresos proyectados por índice de fila: del último real al fin de mes. */
  projectedByIndex: Map<number, number>;
}

/**
 * Une períodos reales y días proyectados en una sola línea de tiempo. El día de
 * hoy ya está entre los reales: su valor proyectado solo alimenta la línea punteada.
 */
export function buildChartRows(points: readonly TimeseriesPoint[], projection: readonly ProjectedDay[]): ChartRows {
  const actual: ChartRow[] = points.map((p) => ({
    bucket: p.bucket,
    incomeCents: p.incomeCents,
    expensesCents: p.expensesCents,
    netCents: p.incomeCents - p.expensesCents,
    isProjected: false,
  }));
  const lastBucket = actual[actual.length - 1]?.bucket ?? '';
  const future = projection.filter((d) => d.day > lastBucket);
  const projectedRows: ChartRow[] = future.map((d) => ({
    bucket: d.day,
    incomeCents: d.incomeCents,
    expensesCents: 0,
    netCents: 0,
    isProjected: true,
  }));
  const lastActualIndex = actual.length - 1;
  const projectedByIndex = new Map<number, number>();
  const today = projection.find((d) => d.day === lastBucket);
  if (today) projectedByIndex.set(lastActualIndex, today.incomeCents);
  projectedRows.forEach((row, i) => projectedByIndex.set(lastActualIndex + 1 + i, row.incomeCents));
  return { rows: [...actual, ...projectedRows], lastActualIndex, projectedByIndex };
}
