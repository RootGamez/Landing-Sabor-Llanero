import type { PaymentMethod } from '@sabor/shared';
import { Search } from 'lucide-react';
import type { ExpenseFilterValues } from '../../lib/expensesApi';
import { cn } from '../../lib/utils';
import { SelectField, TextField, fieldClassName } from '../ui/FormField';
import { RANGE_PRESETS, presetRange, type CategoryOption, type RangePreset } from './expenseUtils';

interface ExpenseFiltersBarProps {
  filters: ExpenseFilterValues;
  /** Texto de búsqueda tal como lo escribe la persona (el filtro real va con retraso). */
  searchText: string;
  categories: readonly CategoryOption[];
  methods: readonly PaymentMethod[];
  onChange: (patch: Partial<ExpenseFilterValues>) => void;
  onSearchTextChange: (text: string) => void;
}

function activePreset(filters: ExpenseFilterValues): RangePreset['key'] | null {
  const match = RANGE_PRESETS.find((preset) => {
    const range = presetRange(preset.key);
    return range.from === filters.from && range.to === filters.to;
  });
  return match?.key ?? null;
}

/** Filtros del historial: rango (atajos + fechas), categoría, método de pago y búsqueda por nota. */
export function ExpenseFiltersBar({ filters, searchText, categories, methods, onChange, onSearchTextChange }: ExpenseFiltersBarProps) {
  const current = activePreset(filters);
  return (
    <div role="search" aria-label="Filtrar gastos" className="flex flex-col gap-4">
      <div role="group" aria-label="Rango de fechas" className="flex flex-wrap gap-2">
        {RANGE_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            aria-pressed={current === preset.key}
            onClick={() => onChange(presetRange(preset.key))}
            className={cn(
              'min-h-11 cursor-pointer rounded-full border-2 px-4 text-sm font-semibold transition-colors',
              current === preset.key
                ? 'border-forest bg-primary text-primary-foreground'
                : 'border-border bg-surface text-text hover:border-forest-line/60',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          id="ef-from"
          label="Desde"
          type="date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(event) => onChange({ from: event.target.value })}
        />
        <TextField
          id="ef-to"
          label="Hasta"
          type="date"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(event) => onChange({ to: event.target.value })}
        />
        <SelectField
          id="ef-category"
          label="Categoría"
          value={filters.categoryId ?? ''}
          onChange={(event) => onChange({ categoryId: event.target.value ? Number(event.target.value) : null })}
        >
          <option value="">Todas</option>
          {categories.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="ef-method"
          label="Método de pago"
          value={filters.paymentMethod}
          onChange={(event) => onChange({ paymentMethod: event.target.value })}
        >
          <option value="">Todos</option>
          {methods.map((method) => (
            <option key={method.key} value={method.key}>
              {method.label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ef-search" className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">
          Buscar en la nota
        </label>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <input
            id="ef-search"
            type="search"
            value={searchText}
            maxLength={20}
            autoComplete="off"
            placeholder="Ej. harina, gas, delivery"
            onChange={(event) => onSearchTextChange(event.target.value)}
            className={cn(fieldClassName, 'pl-10')}
          />
        </div>
      </div>
    </div>
  );
}
