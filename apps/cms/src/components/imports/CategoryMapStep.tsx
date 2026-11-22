import type { HomebankCategoryPreview } from '@sabor/shared';
import type { CategoryOption } from '../expenses/expenseUtils';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/ErrorState';
import { Select } from '../ui/Select';
import { CREATE_CHOICE, NO_CHOICE, cannotCreate, unresolvedCategories, type PreviewTotals } from './importUtils';

interface CategoryMapStepProps {
  preview: PreviewTotals;
  existingCategories: readonly CategoryOption[];
  choices: Readonly<Record<string, string>>;
  newExpenses: number;
  newIncomes: number;
  error: string | null;
  onChoice: (name: string, value: string) => void;
  onBack: () => void;
  onImport: () => void;
}

const categoryLabel = (name: string): string => (name === '' ? 'Sin categoría' : name.replaceAll(':', ' › '));

/** Paso 3: duplicados que se omitirán y destino de cada categoría del archivo que aún no existe. */
export function CategoryMapStep({
  preview,
  existingCategories,
  choices,
  newExpenses,
  newIncomes,
  error,
  onChoice,
  onBack,
  onImport,
}: CategoryMapStepProps) {
  const missing = preview.categories.filter((c) => c.categoryId === null);
  const known = preview.categories.filter((c) => c.categoryId !== null);
  const pending = unresolvedCategories(preview.categories, choices);
  const alreadyThere = preview.expensesExisting + preview.incomesExisting;
  const active = existingCategories.filter((c) => c.isActive);

  return (
    <div className="flex flex-col gap-5">
      <div role="status" className="rounded-xl bg-muted px-4 py-3 text-sm text-text">
        {alreadyThere > 0 ? (
          <>
            Ya existen <strong>{preview.expensesExisting}</strong> gastos y <strong>{preview.incomesExisting}</strong> ventas
            de este archivo: se omitirán. Se importarán <strong>{newExpenses}</strong> gastos y <strong>{newIncomes}</strong>{' '}
            ventas nuevas.
          </>
        ) : (
          <>
            Nada de este archivo está importado todavía: se cargarán <strong>{newExpenses}</strong> gastos y{' '}
            <strong>{newIncomes}</strong> ventas.
          </>
        )}
      </div>

      {missing.length > 0 ? (
        <section aria-labelledby="map-title" className="flex flex-col gap-3">
          <div>
            <h3 id="map-title" className="font-display text-base font-bold text-text">
              Categorías nuevas
            </h3>
            <p className="text-sm text-text-muted">
              Estas categorías del archivo no existen aún. Créalas tal cual o asígnalas a una de las tuyas.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {missing.map((category) => (
              <CategoryRow
                key={category.name}
                category={category}
                active={active}
                value={choices[category.name] ?? NO_CHOICE}
                onChange={(value) => onChoice(category.name, value)}
              />
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-text-muted">Todas las categorías del archivo ya existen: no hay nada que mapear.</p>
      )}

      {known.length > 0 ? (
        <p className="text-sm text-text-muted">
          Ya existen:{' '}
          {known.map((c) => `${categoryLabel(c.name)} (${c.count})`).join(', ')}.
        </p>
      ) : null}

      {error ? <ErrorState message={error} onRetry={onImport} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          Atrás
        </Button>
        <Button onClick={onImport} disabled={pending.length > 0 || newExpenses + newIncomes === 0}>
          Importar
        </Button>
      </div>
      {pending.length > 0 ? (
        <p role="status" className="text-sm text-destructive">
          Elige una categoría para: {pending.map(categoryLabel).join(', ')}.
        </p>
      ) : null}
      {newExpenses + newIncomes === 0 ? (
        <p role="status" className="text-sm text-text-muted">
          No hay filas nuevas para importar.
        </p>
      ) : null}
    </div>
  );
}

interface CategoryRowProps {
  category: HomebankCategoryPreview;
  active: readonly CategoryOption[];
  value: string;
  onChange: (value: string) => void;
}

function CategoryRow({ category, active, value, onChange }: CategoryRowProps) {
  const canCreate = !cannotCreate(category.name);
  const options = [
    ...(canCreate ? [{ value: CREATE_CHOICE, label: `Crear «${categoryLabel(category.name)}»` }] : []),
    ...(value === NO_CHOICE ? [{ value: NO_CHOICE, label: 'Elige una categoría…', disabled: true }] : []),
    ...active.map((option) => ({ value: String(option.id), label: `Asignar a ${option.label}` })),
  ];
  return (
    <li className="flex flex-col gap-2 rounded-xl border-2 border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-bold text-text">{categoryLabel(category.name)}</p>
        <p className="text-xs text-text-muted tabular-nums">{category.count} gastos</p>
      </div>
      <div className="sm:w-72">
        <Select
          aria-label={`Destino de ${categoryLabel(category.name)}`}
          value={value}
          onValueChange={onChange}
          invalid={value === NO_CHOICE}
          options={options}
        />
      </div>
    </li>
  );
}
