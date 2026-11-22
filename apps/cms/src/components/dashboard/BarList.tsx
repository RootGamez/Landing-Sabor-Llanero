import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface BarListItem {
  key: string;
  label: string;
  /** Medida que dibuja la barra. */
  value: number;
  valueText: string;
  /** Dato complementario en texto muted (unidades, % del total…). */
  secondaryText?: string;
  /** Detalle bajo la barra (subcategorías…). */
  detail?: ReactNode;
}

interface BarListProps {
  items: readonly BarListItem[];
  /** Color de la barra como clase de Tailwind (`bg-chart-income`, `bg-chart-expense`). */
  barClassName: string;
  /** Nombre de la lista para lectores de pantalla. */
  ariaLabel: string;
}

const MIN_BAR_PERCENT = 1.5;

/**
 * Barras horizontales ordenadas (ranking): etiqueta y valor siempre visibles
 * en texto, la barra solo refuerza la magnitud. Se lee bien en una columna
 * angosta (móvil) y es una lista semántica para lectores de pantalla.
 */
export function BarList({ items, barClassName, ariaLabel }: BarListProps) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ol aria-label={ariaLabel} className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 break-words font-medium text-text">{item.label}</span>
            <span className="shrink-0 text-right tabular-nums">
              <span className="font-semibold text-text">{item.valueText}</span>
              {item.secondaryText && <span className="ml-2 text-xs text-text-muted">{item.secondaryText}</span>}
            </span>
          </div>
          <div aria-hidden="true" className="h-2.5 w-full rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full', barClassName)}
              style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? MIN_BAR_PERCENT : 0)}%` }}
            />
          </div>
          {item.detail}
        </li>
      ))}
    </ol>
  );
}
