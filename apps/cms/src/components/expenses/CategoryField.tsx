import { ChipGroup } from './ChipGroup';
import { CategoryCombobox } from './CategoryCombobox';
import type { CategorySelection } from './categorySelection';
import { topCategories, type CategoryOption } from './expenseUtils';

interface CategoryFieldProps {
  id: string;
  /** Categorías activas: las más usadas salen como chips y todas en el combobox. */
  categories: readonly CategoryOption[];
  value: CategorySelection | null;
  onChange: (value: CategorySelection | null) => void;
  onBlur?: () => void;
  error?: string;
}

/** Tipo de gasto: chips de las más usadas + combobox para buscar o escribir un tipo nuevo. */
export function CategoryField({ id, categories, value, onChange, onBlur, error }: CategoryFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">Tipo de gasto</span>
      <ChipGroup
        label="Tipos más usados"
        options={topCategories(categories).map((o) => ({ value: o.id, label: o.label, color: o.color }))}
        value={value?.kind === 'existing' ? value.id : null}
        onChange={(categoryId) => onChange({ kind: 'existing', id: categoryId })}
      />
      <CategoryCombobox
        id={id}
        label="Otro tipo"
        categories={categories}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        error={error}
      />
    </div>
  );
}
