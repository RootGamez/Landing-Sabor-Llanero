import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  MONTHS,
  WEEKDAYS_LONG,
  WEEKDAYS_SHORT,
  addDays,
  addMonths,
  clampDate,
  formatLong,
  monthGrid,
  parts,
  today,
  weekdayIndex,
} from './dateUtils';

export interface CalendarProps {
  /** Día con el foco de teclado; su mes es el que se muestra. */
  focused: string;
  onFocusedChange: (iso: string) => void;
  onSelect: (iso: string) => void;
  /** Día (o inicio de rango) seleccionado. */
  from?: string;
  /** Fin de rango seleccionado. */
  to?: string;
  /** Día bajo el puntero/foco mientras se elige el fin de rango (vista previa). */
  preview?: string;
  onPreviewChange?: (iso: string | null) => void;
  min?: string;
  max?: string;
  /** Enfoca el día activo al montarse (calendarios dentro de un popover). */
  autoFocusDay?: boolean;
}

/** Desplazamientos de teclado (WAI-ARIA date grid). Devuelve `null` si la tecla no navega. */
function keyTarget(key: string, shift: boolean, iso: string): string | null {
  const weekday = weekdayIndex(iso);
  switch (key) {
    case 'ArrowLeft': return addDays(iso, -1);
    case 'ArrowRight': return addDays(iso, 1);
    case 'ArrowUp': return addDays(iso, -7);
    case 'ArrowDown': return addDays(iso, 7);
    case 'Home': return addDays(iso, -weekday);
    case 'End': return addDays(iso, 6 - weekday);
    case 'PageUp': return addMonths(iso, shift ? -12 : -1);
    case 'PageDown': return addMonths(iso, shift ? 12 : 1);
    default: return null;
  }
}

function inRange(iso: string, from?: string, to?: string): boolean {
  return !!from && !!to && iso >= from && iso <= to;
}

interface DayCellProps {
  iso: string;
  inMonth: boolean;
  isFocused: boolean;
  isEdge: boolean;
  isBetween: boolean;
  disabled: boolean;
  onPick: (iso: string) => void;
  onHover?: (iso: string | null) => void;
}

function DayCell({ iso, inMonth, isFocused, isEdge, isBetween, disabled, onPick, onHover }: DayCellProps) {
  const isToday = iso === today();
  return (
    <td role="gridcell" aria-selected={isEdge || isBetween} className="p-0 text-center">
      <button
        type="button"
        data-iso={iso}
        tabIndex={isFocused ? 0 : -1}
        disabled={disabled}
        aria-label={formatLong(iso)}
        aria-current={isToday ? 'date' : undefined}
        onClick={() => onPick(iso)}
        onMouseEnter={() => onHover?.(iso)}
        className={cn(
          'inline-flex size-11 cursor-pointer items-center justify-center rounded-lg text-sm tabular-nums transition-colors hover:bg-lime-soft disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent',
          !inMonth && 'text-text-muted',
          isToday && !isEdge && 'border-2 border-forest font-bold',
          isBetween && 'rounded-none bg-lime-soft',
          isEdge && 'rounded-lg bg-primary font-bold text-primary-foreground hover:bg-primary'
        )}
      >
        {parts(iso).day}
      </button>
    </td>
  );
}

interface HeaderProps {
  focused: string;
  titleId: string;
  onShift: (months: number) => void;
}

function CalendarHeader({ focused, titleId, onShift }: HeaderProps) {
  const { year, month } = parts(focused);
  const navClass =
    'inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-text hover:bg-muted';
  return (
    <div className="mb-1 flex items-center justify-between">
      <button type="button" className={navClass} aria-label="Mes anterior" onClick={() => onShift(-1)}>
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <div id={titleId} aria-live="polite" className="font-display text-sm font-bold capitalize text-text">
        {MONTHS[month]} {year}
      </div>
      <button type="button" className={navClass} aria-label="Mes siguiente" onClick={() => onShift(1)}>
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Calendario de un mes, semana desde lunes, en español. Navegación completa
 * por teclado (flechas, Inicio/Fin, RePág/AvPág, Shift+RePág/AvPág = año).
 * Sirve tanto para fecha única (`from`) como para rango (`from` + `to`).
 */
export function Calendar({ focused, onFocusedChange, onSelect, from, to, preview, onPreviewChange, min, max, autoFocusDay }: CalendarProps) {
  const titleId = useId();
  const gridRef = useRef<HTMLTableElement>(null);
  const shouldFocus = useRef(false);
  const month = parts(focused).month;

  useEffect(() => {
    if (autoFocusDay) shouldFocus.current = true;
    // Solo al montar: el resto del foco lo gobierna el teclado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`button[data-iso="${focused}"]`)?.focus();
  }, [focused]);

  function moveFocus(iso: string) {
    const next = clampDate(iso, min, max);
    if (next === focused) return;
    shouldFocus.current = true;
    onFocusedChange(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    const target = keyTarget(event.key, event.shiftKey, focused);
    if (!target) return;
    event.preventDefault();
    moveFocus(target);
    onPreviewChange?.(null);
  }

  const rangeEnd = to ?? (from && preview && preview >= from ? preview : undefined);

  return (
    <div role="group" aria-label="Calendario" className="w-[19.25rem] max-w-full">
      <CalendarHeader focused={focused} titleId={titleId} onShift={(n) => onFocusedChange(clampDate(addMonths(focused, n), min, max))} />
      <table
        ref={gridRef}
        role="grid"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        onMouseLeave={() => onPreviewChange?.(null)}
        className="w-full border-collapse"
      >
        <thead>
          <tr>
            {WEEKDAYS_SHORT.map((label, i) => (
              <th key={label} scope="col" abbr={WEEKDAYS_LONG[i]} className="pb-1 text-xs font-bold uppercase text-text-muted">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(focused).map((week) => (
            <tr key={week[0]}>
              {week.map((iso) => (
                <DayCell
                  key={iso}
                  iso={iso}
                  inMonth={parts(iso).month === month}
                  isFocused={iso === focused}
                  isEdge={iso === from || iso === to}
                  isBetween={inRange(iso, from, rangeEnd)}
                  disabled={(!!min && iso < min) || (!!max && iso > max)}
                  onPick={(picked) => {
                    onFocusedChange(picked);
                    onSelect(picked);
                  }}
                  onHover={onPreviewChange}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

