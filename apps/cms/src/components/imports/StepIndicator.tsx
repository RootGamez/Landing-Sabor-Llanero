import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ImportStep } from './useHomebankImport';

const STEPS: ReadonlyArray<{ id: number; label: string; covers: readonly ImportStep[] }> = [
  { id: 1, label: 'Archivo', covers: ['upload'] },
  { id: 2, label: 'Resumen', covers: ['summary'] },
  { id: 3, label: 'Categorías', covers: ['categories'] },
  { id: 4, label: 'Importar', covers: ['importing', 'done'] },
];

function currentIndex(step: ImportStep): number {
  return STEPS.findIndex((s) => s.covers.includes(step));
}

/** Indicador de los 4 pasos; el paso actual se anuncia con `aria-current="step"`. */
export function StepIndicator({ step }: { step: ImportStep }) {
  const current = currentIndex(step);
  return (
    <nav aria-label="Pasos de la importación">
      <ol className="flex items-center gap-2">
        {STEPS.map((s, index) => {
          const isDone = index < current || step === 'done';
          const isCurrent = index === current && step !== 'done';
          return (
            <li
              key={s.id}
              aria-current={isCurrent ? 'step' : undefined}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold',
                  isDone && 'border-forest bg-primary text-primary-foreground',
                  isCurrent && 'border-forest bg-accent text-accent-foreground',
                  !isDone && !isCurrent && 'border-border bg-surface text-text-muted',
                )}
              >
                {isDone ? <Check className="size-4" /> : s.id}
              </span>
              <span
                className={cn(
                  'truncate text-xs font-bold uppercase tracking-wide max-sm:sr-only',
                  isCurrent ? 'text-text' : 'text-text-muted',
                )}
              >
                {s.label}
                {isDone ? <span className="sr-only"> (completado)</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
