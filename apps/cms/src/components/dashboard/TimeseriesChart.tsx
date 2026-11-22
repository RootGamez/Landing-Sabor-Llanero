import { useRef, useState } from 'react';
import { formatPEN, type ReportGranularity, type TimeseriesPoint } from '@sabor/shared';
import { formatAxisSoles, formatBucketAxis, formatBucketLong, niceTicks } from '../../lib/dashboardFormat';
import { useElementWidth } from '../../hooks/useElementWidth';

const HEIGHT = 260;
const MARGIN = { top: 12, right: 14, bottom: 30, left: 62 } as const;
const AXIS_TICKS = 4;
const MARKER_MAX_POINTS = 31;
const LABEL_MIN_SPACING = 76;
const TOOLTIP_WIDTH = 190;

interface TimeseriesChartProps {
  points: readonly TimeseriesPoint[];
  granularity: ReportGranularity;
}

function linePath(xs: readonly number[], ys: readonly number[]): string {
  return xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i]!.toFixed(1)}`).join(' ');
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-text">
      <li className="flex items-center gap-2">
        <svg width="24" height="8" aria-hidden="true">
          <line x1="0" y1="4" x2="24" y2="4" stroke="var(--chart-income)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        Ingresos
      </li>
      <li className="flex items-center gap-2">
        <svg width="24" height="8" aria-hidden="true">
          <line x1="0" y1="4" x2="24" y2="4" stroke="var(--chart-expense)" strokeWidth="2.5" strokeDasharray="6 4" />
        </svg>
        Egresos
      </li>
    </ul>
  );
}

function Tooltip({ point, granularity, left }: { point: TimeseriesPoint; granularity: ReportGranularity; left: number }) {
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md"
      style={{ left, width: TOOLTIP_WIDTH }}
    >
      <p className="mb-1 font-bold text-text first-letter:uppercase">{formatBucketLong(point.bucket, granularity)}</p>
      <p className="flex items-center justify-between gap-2 text-text">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-0.5 w-3.5 rounded bg-chart-income" /> Ingresos
        </span>
        <span className="font-semibold tabular-nums">{formatPEN(point.incomeCents)}</span>
      </p>
      <p className="flex items-center justify-between gap-2 text-text">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-0.5 w-3.5 rounded border-t-2 border-dashed border-chart-expense" /> Egresos
        </span>
        <span className="font-semibold tabular-nums">{formatPEN(point.expensesCents)}</span>
      </p>
    </div>
  );
}

/** Tabla equivalente para lectores de pantalla (el SVG va como imagen con resumen). */
function DataTable({ points, granularity }: TimeseriesChartProps) {
  return (
    <table className="sr-only">
      <caption>Ingresos y egresos por {granularity === 'day' ? 'día' : granularity === 'week' ? 'semana' : 'mes'}</caption>
      <thead>
        <tr>
          <th scope="col">Período</th>
          <th scope="col">Ingresos</th>
          <th scope="col">Egresos</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.bucket}>
            <th scope="row">{formatBucketLong(p.bucket, granularity)}</th>
            <td>{formatPEN(p.incomeCents)}</td>
            <td>{formatPEN(p.expensesCents)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Ingresos vs egresos en el tiempo: dos líneas (sólida / punteada), crosshair y tooltip por puntero o teclado. */
export function TimeseriesChart({ points, granularity }: TimeseriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(containerRef);
  const [active, setActive] = useState<number | null>(null);

  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 40);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const maxValue = Math.max(...points.flatMap((p) => [p.incomeCents, p.expensesCents]));
  const ticks = niceTicks(maxValue, AXIS_TICKS);
  const yMax = ticks[ticks.length - 1]!;

  const xAt = (i: number) => MARGIN.left + (points.length === 1 ? plotW / 2 : (i * plotW) / (points.length - 1));
  const yAt = (v: number) => MARGIN.top + plotH - (v / yMax) * plotH;
  const xs = points.map((_, i) => xAt(i));
  const labelStep = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotW / LABEL_MIN_SPACING))));

  const nearestIndex = (clientX: number): number => {
    const box = containerRef.current?.getBoundingClientRect();
    const x = clientX - (box?.left ?? 0);
    return xs.reduce((best, cx, i) => (Math.abs(cx - x) < Math.abs(xs[best]! - x) ? i : best), 0);
  };

  const handleKey = (event: React.KeyboardEvent) => {
    const last = points.length - 1;
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

  const activePoint = active === null ? null : points[active]!;
  const tooltipLeft = activePoint ? Math.max(0, Math.min(xs[active!]! - TOOLTIP_WIDTH / 2, width - TOOLTIP_WIDTH)) : 0;
  const showMarkers = points.length <= MARKER_MAX_POINTS;
  const peak = points.reduce((best, p) => (p.incomeCents > best.incomeCents ? p : best), points[0]!);

  return (
    <div className="flex flex-col gap-3">
      <Legend />
      <div ref={containerRef} className="relative w-full">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Gráfico de ingresos y egresos. ${peak.incomeCents > 0 ? `Mejor ${granularity === 'day' ? 'día' : granularity === 'week' ? 'semana' : 'mes'} de ingresos: ${formatBucketLong(peak.bucket, granularity)} con ${formatPEN(peak.incomeCents)}. ` : ''}Usa las flechas del teclado para recorrer los puntos.`}
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
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={yAt(tick)} y2={yAt(tick)} stroke="var(--chart-grid)" strokeWidth="1" />
              <text x={MARGIN.left - 8} y={yAt(tick)} dy="0.32em" textAnchor="end" fontSize="12" fill="var(--chart-axis)">
                {formatAxisSoles(tick)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % labelStep === 0 ? (
              <text key={p.bucket} x={xs[i]} y={HEIGHT - 8} textAnchor="middle" fontSize="12" fill="var(--chart-axis)">
                {formatBucketAxis(p.bucket, granularity)}
              </text>
            ) : null,
          )}
          {active !== null && (
            <line x1={xs[active]} x2={xs[active]} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke="var(--chart-axis)" strokeWidth="1" strokeDasharray="3 3" />
          )}
          <path d={linePath(xs, points.map((p) => yAt(p.expensesCents)))} fill="none" stroke="var(--chart-expense)" strokeWidth="2.5" strokeDasharray="7 4" strokeLinejoin="round" />
          <path d={linePath(xs, points.map((p) => yAt(p.incomeCents)))} fill="none" stroke="var(--chart-income)" strokeWidth="2.5" strokeLinejoin="round" />
          {(showMarkers || points.length === 1) &&
            points.map((p, i) => (
              <g key={p.bucket}>
                <circle cx={xs[i]} cy={yAt(p.expensesCents)} r={active === i ? 5 : 3.5} fill="var(--chart-expense)" stroke="var(--card)" strokeWidth="2" />
                <circle cx={xs[i]} cy={yAt(p.incomeCents)} r={active === i ? 5 : 3.5} fill="var(--chart-income)" stroke="var(--card)" strokeWidth="2" />
              </g>
            ))}
        </svg>
        {activePoint && <Tooltip point={activePoint} granularity={granularity} left={tooltipLeft} />}
      </div>
      <p className="sr-only" aria-live="polite">
        {activePoint &&
          `${formatBucketLong(activePoint.bucket, granularity)}: ingresos ${formatPEN(activePoint.incomeCents)}, egresos ${formatPEN(activePoint.expensesCents)}`}
      </p>
      <DataTable points={points} granularity={granularity} />
    </div>
  );
}
