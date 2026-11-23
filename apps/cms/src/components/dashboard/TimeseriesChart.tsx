import { useRef, useState } from 'react';
import { formatPEN, type ProjectedDay, type ReportGranularity, type TimeseriesPoint } from '@sabor/shared';
import { formatAxisSoles, formatBucketAxis, formatBucketLong, niceTicksRange } from '../../lib/dashboardFormat';
import { useElementWidth } from '../../hooks/useElementWidth';
import { DataTable, Legend, TOOLTIP_WIDTH, Tooltip, granularityNoun } from './TimeseriesParts';
import { buildChartRows } from './timeseriesRows';

const HEIGHT = 260;
const MARGIN = { top: 12, right: 14, bottom: 30, left: 62 } as const;
const AXIS_TICKS = 4;
const MARKER_MAX_POINTS = 31;
const LABEL_MIN_SPACING = 76;
const NET_BAR_MIN = 3;
const NET_BAR_MAX = 14;
const NET_BAR_SHARE = 0.55;

interface TimeseriesChartProps {
  points: readonly TimeseriesPoint[];
  granularity: ReportGranularity;
  /** Dibuja la ganancia neta (ingresos − egresos) como columnas desde el cero. */
  showNet?: boolean;
  /** Ingresos proyectados de hoy a fin de mes (solo con granularidad diaria). */
  projection?: readonly ProjectedDay[];
}

function linePath(xs: readonly number[], ys: readonly number[]): string {
  return xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i]!.toFixed(1)}`).join(' ');
}

/**
 * Ingresos vs egresos en el tiempo: dos líneas (sólida / punteada), ganancia
 * neta en columnas, proyección en línea de puntos, crosshair y tooltip por
 * puntero o teclado.
 */
export function TimeseriesChart({ points, granularity, showNet = false, projection = [] }: TimeseriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(containerRef);
  const [active, setActive] = useState<number | null>(null);

  const { rows, lastActualIndex, projectedByIndex } = buildChartRows(points, granularity === 'day' ? projection : []);
  const hasProjection = projectedByIndex.size > 1;

  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 40);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const values = rows.flatMap((r) => [r.incomeCents, r.expensesCents, ...(showNet ? [r.netCents] : [])]);
  const ticks = niceTicksRange(Math.min(0, ...values), Math.max(...values), AXIS_TICKS);
  const yMin = ticks[0]!;
  const yMax = ticks[ticks.length - 1]!;

  const xAt = (i: number) => MARGIN.left + (rows.length === 1 ? plotW / 2 : (i * plotW) / (rows.length - 1));
  const yAt = (v: number) => MARGIN.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const xs = rows.map((_, i) => xAt(i));
  const labelStep = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(plotW / LABEL_MIN_SPACING))));
  const barWidth = Math.min(NET_BAR_MAX, Math.max(NET_BAR_MIN, (plotW / rows.length) * NET_BAR_SHARE));
  const actualRows = rows.slice(0, lastActualIndex + 1);
  const actualXs = xs.slice(0, lastActualIndex + 1);

  const nearestIndex = (clientX: number): number => {
    const box = containerRef.current?.getBoundingClientRect();
    const x = clientX - (box?.left ?? 0);
    return xs.reduce((best, cx, i) => (Math.abs(cx - x) < Math.abs(xs[best]! - x) ? i : best), 0);
  };

  const handleKey = (event: React.KeyboardEvent) => {
    const last = rows.length - 1;
    const moves: Record<string, number> = {
      ArrowLeft: Math.max(0, (active ?? last + 1) - 1),
      ArrowRight: Math.min(last, (active ?? -1) + 1),
      Home: 0,
      End: last,
    };
    if (event.key === 'Escape') setActive(null);
    else if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]!);
    }
  };

  const activeRow = active === null ? null : rows[active]!;
  const tooltipLeft = activeRow ? Math.max(0, Math.min(xs[active!]! - TOOLTIP_WIDTH / 2, width - TOOLTIP_WIDTH)) : 0;
  const showMarkers = actualRows.length <= MARKER_MAX_POINTS;
  const peak = actualRows.reduce((best, r) => (r.incomeCents > best.incomeCents ? r : best), actualRows[0]!);
  const projectedIdx = [...projectedByIndex.keys()];

  return (
    <div className="flex flex-col gap-3">
      <Legend showNet={showNet} showProjection={hasProjection} />
      <div ref={containerRef} className="relative w-full">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Gráfico de ingresos y egresos${showNet ? ' con ganancia neta' : ''}. ${peak.incomeCents > 0 ? `Mejor ${granularityNoun(granularity)} de ingresos: ${formatBucketLong(peak.bucket, granularity)} con ${formatPEN(peak.incomeCents)}. ` : ''}Usa las flechas del teclado para recorrer los puntos.`}
          tabIndex={0}
          className="block touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onPointerMove={(e) => setActive(nearestIndex(e.clientX))}
          onPointerDown={(e) => setActive(nearestIndex(e.clientX))}
          onPointerLeave={() => setActive(null)}
          onKeyDown={handleKey}
          onBlur={() => setActive(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={yAt(tick)} y2={yAt(tick)} stroke={tick === 0 && yMin < 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'} strokeWidth="1" />
              <text x={MARGIN.left - 8} y={yAt(tick)} dy="0.32em" textAnchor="end" fontSize="12" fill="var(--chart-axis)">
                {formatAxisSoles(tick)}
              </text>
            </g>
          ))}
          {rows.map((r, i) =>
            i % labelStep === 0 ? (
              <text key={r.bucket} x={xs[i]} y={HEIGHT - 8} textAnchor="middle" fontSize="12" fill="var(--chart-axis)">
                {formatBucketAxis(r.bucket, granularity)}
              </text>
            ) : null,
          )}
          {active !== null && (
            <line x1={xs[active]} x2={xs[active]} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke="var(--chart-axis)" strokeWidth="1" strokeDasharray="3 3" />
          )}
          {showNet &&
            actualRows.map((r, i) => {
              const top = yAt(Math.max(r.netCents, 0));
              const bottom = yAt(Math.min(r.netCents, 0));
              return (
                <rect key={r.bucket} x={actualXs[i]! - barWidth / 2} y={top} width={barWidth} height={r.netCents === 0 ? 0 : Math.max(bottom - top, 1)} rx="1.5" fill="var(--chart-net)" opacity="0.85" />
              );
            })}
          <path d={linePath(actualXs, actualRows.map((r) => yAt(r.expensesCents)))} fill="none" stroke="var(--chart-expense)" strokeWidth="2.5" strokeDasharray="7 4" strokeLinejoin="round" />
          <path d={linePath(actualXs, actualRows.map((r) => yAt(r.incomeCents)))} fill="none" stroke="var(--chart-income)" strokeWidth="2.5" strokeLinejoin="round" />
          {hasProjection && (
            <path d={linePath(projectedIdx.map((i) => xs[i]!), projectedIdx.map((i) => yAt(projectedByIndex.get(i)!)))} fill="none" stroke="var(--chart-income)" strokeWidth="2.5" strokeDasharray="1.5 6" strokeLinecap="round" />
          )}
          {(showMarkers || actualRows.length === 1) &&
            actualRows.map((r, i) => (
              <g key={r.bucket}>
                <circle cx={actualXs[i]} cy={yAt(r.expensesCents)} r={active === i ? 5 : 3.5} fill="var(--chart-expense)" stroke="var(--card)" strokeWidth="2" />
                <circle cx={actualXs[i]} cy={yAt(r.incomeCents)} r={active === i ? 5 : 3.5} fill="var(--chart-income)" stroke="var(--card)" strokeWidth="2" />
              </g>
            ))}
        </svg>
        {activeRow && <Tooltip row={activeRow} granularity={granularity} left={tooltipLeft} showNet={showNet} />}
      </div>
      <p className="sr-only" aria-live="polite">
        {activeRow &&
          (activeRow.isProjected
            ? `${formatBucketLong(activeRow.bucket, granularity)}: ingresos proyectados ${formatPEN(activeRow.incomeCents)}`
            : `${formatBucketLong(activeRow.bucket, granularity)}: ingresos ${formatPEN(activeRow.incomeCents)}, egresos ${formatPEN(activeRow.expensesCents)}${showNet ? `, ganancia neta ${formatPEN(activeRow.netCents)}` : ''}`)}
      </p>
      <DataTable rows={rows} granularity={granularity} showNet={showNet} />
    </div>
  );
}
