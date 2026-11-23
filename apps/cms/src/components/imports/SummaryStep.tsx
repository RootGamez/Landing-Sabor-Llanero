import { CheckboxField } from '../ui/Checkbox';
import { Collapsible, CollapsibleContent, CollapsibleSummary } from '../ui/Collapsible';
import { AlertTriangle } from 'lucide-react';
import { formatPEN, type HomebankParseError, type PreparedHomebankImport } from '@sabor/shared';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/ErrorState';

interface SummaryStepProps {
  fileName: string;
  prepared: PreparedHomebankImport;
  parseErrors: readonly HomebankParseError[];
  includeIncomes: boolean;
  busy: boolean;
  error: string | null;
  onIncludeIncomes: (value: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
}

interface StatProps {
  label: string;
  value: string;
  hint?: string;
}

function Stat({ label, value, hint }: StatProps) {
  return (
    <div className="rounded-xl border-2 border-border bg-surface p-4">
      <dt className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-text">{value}</dd>
      {hint ? <dd className="mt-0.5 text-xs text-text-muted tabular-nums">{hint}</dd> : null}
    </div>
  );
}

/** Tope de errores dibujados: un archivo muy dañado no debe congelar la pantalla. */
const MAX_LISTED_ERRORS = 100;

const formatDay = (iso: string): string => {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};

/** Paso 2: qué se encontró en el archivo y si los ingresos entran como ventas resumen. */
export function SummaryStep({
  fileName,
  prepared,
  parseErrors,
  includeIncomes,
  busy,
  error,
  onIncludeIncomes,
  onBack,
  onContinue,
}: SummaryStepProps) {
  const problemCount = parseErrors.length + prepared.rejected.length;
  const shownParseErrors = parseErrors.slice(0, MAX_LISTED_ERRORS);
  const shownRejected = prepared.rejected.slice(0, Math.max(MAX_LISTED_ERRORS - shownParseErrors.length, 0));
  const nothingToImport = prepared.expenses.length === 0 && (!includeIncomes || prepared.incomes.length === 0);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-muted">
        Leímos <span className="font-semibold text-text">{fileName}</span>
        {prepared.dateRange ? (
          <>
            {' '}
            con movimientos del <span className="font-semibold text-text">{formatDay(prepared.dateRange.from)}</span> al{' '}
            <span className="font-semibold text-text">{formatDay(prepared.dateRange.to)}</span>.
          </>
        ) : (
          '.'
        )}
      </p>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Gastos" value={String(prepared.expenses.length)} hint={formatPEN(prepared.expensesTotalCents)} />
        <Stat label="Ingresos" value={String(prepared.incomes.length)} hint={formatPEN(prepared.incomesTotalCents)} />
        <Stat label="Ignorados" value={String(prepared.ignored)} hint="monto en cero" />
        <Stat label="Con errores" value={String(problemCount)} hint={problemCount > 0 ? 'no se importan' : 'ninguno'} />
      </dl>

      {problemCount > 0 ? (
        <Collapsible className="rounded-xl border-2 border-border bg-card p-1">
          <CollapsibleSummary className="font-display">
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
              Ver las {problemCount} filas con errores
            </span>
          </CollapsibleSummary>
          <CollapsibleContent>
            <ul className="mx-3 mb-3 mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto text-sm text-text-muted">
              {shownParseErrors.map((item, index) => (
                <li key={`p-${index}`}>
                  {item.line > 0 ? `Línea ${item.line}: ` : ''}
                  {item.message}
                </li>
              ))}
              {shownRejected.map((item) => (
                <li key={`r-${item.index}`}>
                  Movimiento {item.index}: {item.message}
                </li>
              ))}
              {problemCount > MAX_LISTED_ERRORS ? <li>… y {problemCount - MAX_LISTED_ERRORS} más.</li> : null}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <CheckboxField
        variant="card"
        label="Importar también los ingresos como ventas resumen del día"
        description="Déjalo desmarcado si tus ventas ya vienen de Aronium o del POS: importarlas también desde HomeBank las contaría dos veces. Solo márcalo para días que no tengas en ningún otro sistema; cada ingreso entra como una venta en una caja ya cerrada de ese día."
        checked={includeIncomes}
        disabled={busy}
        onCheckedChange={(value) => onIncludeIncomes(value === true)}
      />

      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-text">
        Puedes volver a subir el mismo archivo cuando quieras: lo que ya importaste se reconoce y no se duplica.
      </p>

      {error ? <ErrorState message={error} onRetry={onContinue} /> : null}

      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          Elegir otro archivo
        </Button>
        <Button onClick={onContinue} loading={busy} disabled={nothingToImport}>
          Continuar
        </Button>
      </div>
      {nothingToImport ? (
        <p role="status" className="text-sm text-text-muted">
          No hay nada que importar con estas opciones.
        </p>
      ) : null}
    </div>
  );
}
