import type { PaymentMethod } from '@sabor/shared';
import { Search } from 'lucide-react';
import type { ExpenseFilterValues } from '../../lib/expensesApi';
import { cn } from '../../lib/utils';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
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
        <DatePicker
          id="ef-from"
          label="Desde"
          value={filters.from}
          max={filters.to || undefined}
          onValueChange={(from) => onChange({ from })}
          clearable
        />
        <DatePicker
          id="ef-to"
          label="Hasta"
          value={filters.to}
          min={filters.from || undefined}
          onValueChange={(to) => onChange({ to })}
          clearable
        />
        <Select
          id="ef-category"
          label="Categoría"
          value={filters.categoryId === null ? '' : String(filters.categoryId)}
          onValueChange={(next) => onChange({ categoryId: next ? Number(next) : null })}
          options={[{ value: '', label: 'Todas' }, ...categories.map((o) => ({ value: String(o.id), label: o.label }))]}
        />
        <Select
          id="ef-method"
          label="Método de pago"
          value={filters.paymentMethod}
          onValueChange={(paymentMethod) => onChange({ paymentMethod })}
          options={[{ value: '', label: 'Todos' }, ...methods.map((m) => ({ value: m.key, label: m.label }))]}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="ef-search" className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">
          Buscar en el detalle
        </label>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            id="ef-search"
            type="search"
            value={searchText}
            maxLength={20}
            autoComplete="off"
            placeholder="Ej. harina, gas, delivery"
            onChange={(event) => onSearchTextChange(event.target.value)}
            className="pl-10"
          />
        </div>
      </div>
    </div>
  );
}
