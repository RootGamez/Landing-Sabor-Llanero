import { useRef, useState } from 'react';
import { cn } from '../../lib/utils';

export interface ColumnDatum {
  key: string;
  /** Texto del eje (puede ir vacío para saltar etiquetas en gráficos densos). */
  axisLabel: string;
  /** Título del tooltip y de la tabla accesible. */
  title: string;
  value: number;
  valueText: string;
  detailText: string;
}

interface ColumnChartProps {
  data: readonly ColumnDatum[];
  /** Nombre de la medida, para la tabla accesible ("Ingresos"). */
  measureLabel: string;
  /** Sustantivo del resumen del pico ('Hora' da "Hora con más ventas: …"). */
  peakNoun: string;
  /** Si hay muchas columnas, el eje solo rotula una de cada `labelEvery`. */
  labelEvery?: number;
}

const CHART_HEIGHT_CLASS = 'h-40';
const MIN_BAR_PERCENT = 2;

function tooltipAlign(index: number, count: number): string {
  if (index < count / 3) return 'left-0';
  if (index >= (count * 2) / 3) return 'right-0';
  return 'left-1/2 -translate-x-1/2';
}

interface ColumnProps {
  datum: ColumnDatum;
  index: number;
  count: number;
  max: number;
  labelEvery: number;
  isTabStop: boolean;
  onFocusColumn: (index: number) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

function Column({ datum, index, count, max, labelEvery, isTabStop, onFocusColumn, onKeyDown }: ColumnProps) {
  const percent = datum.value > 0 ? Math.max((datum.value / max) * 100, MIN_BAR_PERCENT) : 0;
  const isLabeled = index % labelEvery === 0;
  return (
    <li className="group relative flex min-w-0 flex-1 flex-col">
      <button
        type="button"
        tabIndex={isTabStop ? 0 : -1}
        onFocus={() => onFocusColumn(index)}
        onKeyDown={onKeyDown}
        // Safari no enfoca botones al tocar: se enfoca a mano para mostrar el tooltip.
        onClick={(event) => event.currentTarget.focus()}
        aria-label={`${datum.title}: ${datum.valueText}, ${datum.detailText}`}
        className={cn('relative flex w-full cursor-pointer items-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring', CHART_HEIGHT_CLASS)}
      >
        <span
          aria-hidden="true"
          className="block w-full rounded-t-[4px] bg-chart-income transition-[filter] group-hover:brightness-125 group-focus-within:brightness-125"
          style={{ height: `${percent}%` }}
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max max-w-44 rounded-lg border border-border bg-card px-3 py-2 text-left text-xs shadow-md group-hover:block group-focus-within:block',
            tooltipAlign(index, count),
          )}
        >
          <span className="block font-bold text-text">{datum.title}</span>
          <span className="block font-semibold tabular-nums text-text">{datum.valueText}</span>
          <span className="block text-text-muted">{datum.detailText}</span>
        </span>
      </button>
      <span aria-hidden="true" className="mt-1 h-4 text-center text-xs text-chart-axis">
        {isLabeled && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{datum.axisLabel}</span>}
      </span>
    </li>
  );
}

/** Columnas de una sola serie (ventas por hora / día de semana): foco o hover muestran el valor exacto. */
export function ColumnChart({ data, measureLabel, peakNoun, labelEvery = 1 }: ColumnChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const listRef = useRef<HTMLUListElement>(null);
  const [tabStop, setTabStop] = useState(0);
  const peak = data.reduce((best, d) => (d.value > best.value ? d : best), data[0]!);

  // Un solo tab stop (roving): Tab entra al gráfico, las flechas recorren las columnas.
  const handleKey = (event: React.KeyboardEvent) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = Math.min(Math.max(tabStop + step, 0), data.length - 1);
    listRef.current?.querySelectorAll('button')[next]?.focus();
  };

  return (
    <figure className="flex flex-col gap-2">
      <ul ref={listRef} className="flex items-end gap-px border-b border-chart-grid sm:gap-1">
        {data.map((datum, index) => (
          <Column
            key={datum.key}
            datum={datum}
            index={index}
            count={data.length}
            max={max}
            labelEvery={labelEvery}
            isTabStop={index === tabStop}
            onFocusColumn={setTabStop}
            onKeyDown={handleKey}
          />
        ))}
      </ul>
      <figcaption className="text-sm text-text-muted">
        {peakNoun} con más ventas: {peak.title.toLowerCase()} ({peak.valueText}).
      </figcaption>
      <table className="sr-only">
        <caption>{measureLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Período</th>
            <th scope="col">Ingresos</th>
            <th scope="col">Ventas</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.title}</th>
              <td>{d.valueText}</td>
              <td>{d.detailText}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
