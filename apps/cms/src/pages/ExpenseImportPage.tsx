import { useEffect, useMemo, useRef } from 'react';
import { CategoryMapStep } from '../components/imports/CategoryMapStep';
import { ImportProgressStep } from '../components/imports/ImportProgressStep';
import { StepIndicator } from '../components/imports/StepIndicator';
import { SummaryStep } from '../components/imports/SummaryStep';
import { UploadStep } from '../components/imports/UploadStep';
import { useHomebankImport } from '../components/imports/useHomebankImport';
import { flattenCategories } from '../components/expenses/expenseUtils';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { useExpenseCategories } from '../hooks/useExpenses';
import { useSessionStore } from '../store/sessionStore';

const STEP_TITLES = {
  upload: '1. Sube tu archivo',
  summary: '2. Revisa el resumen',
  categories: '3. Ordena las categorías',
  importing: '4. Importando',
  done: '4. Listo',
} as const;

/** Solo el dueño importa (la API lo exige); el resto ve un aviso en vez de un 403 al final del asistente. */
export function ExpenseImportPage() {
  const role = useSessionStore((state) => state.user?.role);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Importar gastos</h1>
        <p className="text-sm text-text-muted">
          Sube tu archivo de HomeBank (.xhb o .csv) para cargar tus egresos e ingresos. Importar el mismo archivo otra vez no
          duplica nada.
        </p>
      </div>
      {role === 'owner' ? (
        <ImportWizard />
      ) : (
        <Card>
          <CardContent className="pt-5">
            <EmptyState
              title="Solo el dueño puede importar"
              description="Pídele al dueño del negocio que suba el archivo de HomeBank."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ImportWizard() {
  const categoriesState = useExpenseCategories();
  const categories = useMemo(() => flattenCategories(categoriesState.data ?? []), [categoriesState.data]);
  // El mapeo de categorías necesita la lista completa: no se monta el asistente sin ella.
  if (categoriesState.error) return <ErrorState message={categoriesState.error} onRetry={categoriesState.refetch} />;
  if (!categoriesState.data) return <Skeleton className="h-64 w-full" />;
  return <ImportSteps categories={categories} />;
}

function ImportSteps({ categories }: { categories: ReturnType<typeof flattenCategories> }) {
  const wizard = useHomebankImport(categories);
  const { step, prepared, preview } = wizard;
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Al cambiar de paso el botón pulsado se desmonta: el foco pasa al título del paso nuevo.
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    titleRef.current?.focus();
  }, [step]);

  const newExpenses = prepared && preview ? prepared.expenses.length - preview.expensesExisting : 0;
  const newIncomes = prepared && preview && wizard.includeIncomes ? prepared.incomes.length - preview.incomesExisting : 0;

  return (
    <div className="flex flex-col gap-5">
      <StepIndicator step={step} />
      <Card>
        <CardHeader>
          <h2 ref={titleRef} tabIndex={-1} className="font-display text-lg font-bold leading-tight outline-none">
            {STEP_TITLES[step]}
          </h2>
        </CardHeader>
        <CardContent className="gap-0">
          {step === 'upload' ? (
            <UploadStep
              busy={wizard.busy}
              error={wizard.error}
              fileName={wizard.file?.name ?? null}
              needsDateFormat={wizard.needsDateFormat}
              dateFormat={wizard.dateFormat}
              onFile={(file) => void wizard.loadFile(file)}
              onDateFormat={(format) => void wizard.chooseDateFormat(format)}
            />
          ) : null}
          {step === 'summary' && prepared && wizard.file ? (
            <SummaryStep
              fileName={wizard.file.name}
              prepared={prepared}
              parseErrors={wizard.parseErrors}
              includeIncomes={wizard.includeIncomes}
              busy={wizard.busy}
              error={wizard.error}
              onIncludeIncomes={wizard.setIncludeIncomes}
              onBack={wizard.reset}
              onContinue={() => void wizard.runPreview()}
            />
          ) : null}
          {step === 'categories' && preview ? (
            <CategoryMapStep
              preview={preview}
              existingCategories={categories}
              choices={wizard.choices}
              newExpenses={newExpenses}
              newIncomes={newIncomes}
              error={wizard.error}
              onChoice={wizard.setChoice}
              onBack={() => wizard.setStep('summary')}
              onImport={() => void wizard.startImport()}
            />
          ) : null}
          {step === 'importing' || step === 'done' ? (
            <ImportProgressStep
              isDone={step === 'done'}
              busy={wizard.busy}
              progress={wizard.progress}
              result={wizard.result}
              error={wizard.error}
              onRetry={() => void wizard.resumeImport()}
              onCancel={wizard.cancelImport}
              onRestart={wizard.reset}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
