import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/ErrorState';
import type { ImportResultTotals } from './importUtils';
import type { ImportProgress } from './useHomebankImport';

interface ImportProgressStepProps {
  isDone: boolean;
  busy: boolean;
  progress: ImportProgress;
  result: ImportResultTotals;
  error: string | null;
  onRetry: () => void;
  onCancel: () => void;
  onRestart: () => void;
}

function ResultCard({ label, inserted, duplicates }: { label: string; inserted: number; duplicates: number }) {
  return (
    <div className="rounded-xl border-2 border-border bg-surface p-4">
      <dt className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-text">{inserted} nuevos</dd>
      <dd className="mt-0.5 text-xs text-text-muted tabular-nums">{duplicates} ya existían</dd>
    </div>
  );
}

/** Paso 4: barra de progreso por lotes y, al terminar, el resultado con el enlace a Gastos. */
export function ImportProgressStep({
  isDone,
  busy,
  progress,
  result,
  error,
  onRetry,
  onCancel,
  onRestart,
}: ImportProgressStepProps) {
  const percent = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100);

  return (
    <div className="flex flex-col gap-5">
      {isDone ? (
        <div role="status" className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3">
          <CheckCircle2 className="size-6 shrink-0 text-primary" aria-hidden="true" />
          <p className="font-display text-base font-bold text-text">Importación terminada</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between text-sm">
            <span id="import-progress-label" className="font-medium text-text">
              {busy ? 'Importando…' : 'Importación en pausa'}
            </span>
            <span className="tabular-nums text-text-muted">
              Lote {Math.min(progress.done + (busy ? 1 : 0), progress.total)} de {progress.total}
            </span>
          </div>
          <div
            role="progressbar"
            aria-labelledby="import-progress-label"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-3 overflow-hidden rounded-full border-2 border-forest bg-surface"
          >
            <div className="h-full bg-primary transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
          </div>
          <p role="status" aria-live="polite" className="sr-only">
            {percent}% completado
          </p>
        </div>
      )}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ResultCard label="Gastos" inserted={result.expenses.inserted} duplicates={result.expenses.duplicates} />
        <ResultCard label="Ventas del día" inserted={result.incomes.inserted} duplicates={result.incomes.duplicates} />
      </dl>

      {isDone ? (
        <p className="text-sm text-text-muted">
          Si vuelves a subir este mismo archivo, lo ya importado se reconoce y no se duplica.
        </p>
      ) : null}

      {error ? <ErrorState message={error} onRetry={busy ? undefined : onRetry} /> : null}

      <div className="flex flex-wrap justify-between gap-3">
        {isDone ? (
          <>
            <Button variant="ghost" onClick={onRestart}>
              Importar otro archivo
            </Button>
            <Button asChild>
              <Link to="/gastos">Ver gastos</Link>
            </Button>
          </>
        ) : busy ? (
          <Button variant="outline" onClick={onCancel}>
            Detener
          </Button>
        ) : (
          <Button variant="ghost" onClick={onRestart}>
            Empezar de nuevo
          </Button>
        )}
      </div>
    </div>
  );
}
