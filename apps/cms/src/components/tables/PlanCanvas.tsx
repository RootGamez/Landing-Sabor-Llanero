import type { CSSProperties, ReactNode } from 'react';
import { PLAN_COLS } from '@sabor/shared';
import { cn } from '../../lib/utils';

interface PlanCanvasProps {
  rows: number;
  /** Muestra la cuadrícula de celdas (modo edición). */
  showGrid?: boolean;
  label: string;
  className?: string;
  children: ReactNode;
}

/**
 * Lienzo del plano: mantiene la proporción columnas/filas con `aspect-ratio`
 * y las mesas se ubican en porcentajes (ver `planBox`), así la distribución es
 * la misma a 360 px que en una tablet, sin scroll horizontal.
 */
export function PlanCanvas({ rows, showGrid = false, label, className, children }: PlanCanvasProps) {
  const style: CSSProperties = {
    aspectRatio: `${PLAN_COLS} / ${rows}`,
    ...(showGrid
      ? {
          backgroundImage:
            'linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)',
          backgroundSize: `${100 / PLAN_COLS}% ${100 / rows}%`,
        }
      : {}),
  };
  return (
    <div className={cn('mx-auto w-full max-w-3xl rounded-xl2 border-2 border-border bg-card p-1.5 sm:p-2', className)}>
      <ul aria-label={label} className="relative w-full" style={style}>
        {children}
      </ul>
    </div>
  );
}
