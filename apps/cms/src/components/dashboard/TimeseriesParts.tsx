import { formatPEN, type ReportGranularity } from '@sabor/shared';
import { formatBucketLong } from '../../lib/dashboardFormat';
import type { ChartRow } from './timeseriesRows';

export const TOOLTIP_WIDTH = 200;

interface LegendProps {
  showNet: boolean;
  showProjection: boolean;
}

export function Legend({ showNet, showProjection }: LegendProps) {
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
      {showNet && (
        <li className="flex items-center gap-2">
          <svg width="24" height="10" aria-hidden="true">
            <rect x="4" y="1" width="6" height="8" rx="1" fill="var(--chart-net)" />
            <rect x="13" y="4" width="6" height="5" rx="1" fill="var(--chart-net)" />
          </svg>
          Ganancia neta
        </li>
      )}
      {showProjection && (
        <li className="flex items-center gap-2">
          <svg width="24" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="24" y2="4" stroke="var(--chart-income)" strokeWidth="2.5" strokeDasharray="1.5 5" strokeLinecap="round" />
          </svg>
          Proyección de ingresos
        </li>
      )}
    </ul>
  );
}

const TooltipLine = ({ label, value }: { label: string; value: string }) => (
  <p className="flex items-center justify-between gap-2 text-text">
    <span>{label}</span>
    <span className="font-semibold tabular-nums">{value}</span>
  </p>
);

interface TooltipProps {
  row: ChartRow;
  granularity: ReportGranularity;
  left: number;
  showNet: boolean;
}

export function Tooltip({ row, granularity, left, showNet }: TooltipProps) {
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md"
      style={{ left, width: TOOLTIP_WIDTH }}
    >
      <p className="mb-1 font-bold text-text first-letter:uppercase">{formatBucketLong(row.bucket, granularity)}</p>
      {row.isProjected ? (
        <TooltipLine label="Ingresos proyectados" value={formatPEN(row.incomeCents)} />
      ) : (
        <>
          <TooltipLine label="Ingresos" value={formatPEN(row.incomeCents)} />
          <TooltipLine label="Egresos" value={formatPEN(row.expensesCents)} />
          {showNet && <TooltipLine label="Ganancia neta" value={formatPEN(row.netCents)} />}
        </>
      )}
    </div>
  );
}

const GRANULARITY_NOUN: Record<ReportGranularity, string> = { day: 'día', week: 'semana', month: 'mes' };
export const granularityNoun = (g: ReportGranularity): string => GRANULARITY_NOUN[g];

interface DataTableProps {
  rows: readonly ChartRow[];
  granularity: ReportGranularity;
  showNet: boolean;
}

/** Tabla equivalente para lectores de pantalla (el SVG va como imagen con resumen). */
export function DataTable({ rows, granularity, showNet }: DataTableProps) {
  return (
    <table className="sr-only">
      <caption>Ingresos y egresos por {granularityNoun(granularity)}</caption>
      <thead>
        <tr>
          <th scope="col">Período</th>
          <th scope="col">Ingresos</th>
          <th scope="col">Egresos</th>
          {showNet && <th scope="col">Ganancia neta</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.bucket}>
            <th scope="row">
              {formatBucketLong(r.bucket, granularity)}
              {r.isProjected ? ' (proyección)' : ''}
            </th>
            <td>{formatPEN(r.incomeCents)}</td>
            <td>{r.isProjected ? '—' : formatPEN(r.expensesCents)}</td>
            {showNet && <td>{r.isProjected ? '—' : formatPEN(r.netCents)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
