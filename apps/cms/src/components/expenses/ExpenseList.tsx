import { Pencil, Trash2 } from 'lucide-react';
import { formatPEN, type Expense, type PaymentMethod } from '@sabor/shared';
import { Badge } from '../ui/badge';
import { formatDayHeading, type CategoryOption, type DayGroup } from './expenseUtils';

interface ExpenseListProps {
  groups: readonly DayGroup[];
  categoriesById: ReadonlyMap<number, CategoryOption>;
  /** `false` mientras cargan las categorías: no se rotula como "eliminada" lo que aún no se pudo resolver. */
  categoriesReady: boolean;
  methods: readonly PaymentMethod[];
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}

interface RowProps {
  expense: Expense;
  category: CategoryOption | undefined;
  categoriesReady: boolean;
  methodLabel: string;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}

function ExpenseRow({ expense, category, categoriesReady, methodLabel, onEdit, onDelete }: RowProps) {
  const title = expense.description || 'Sin nota';
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        aria-hidden="true"
        className="size-3 shrink-0 rounded-full border border-forest/30 bg-border"
        style={category?.color ? { backgroundColor: category.color } : undefined}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text">{category?.label ?? (categoriesReady ? 'Categoría eliminada' : '—')}</p>
        <p className="truncate text-xs text-text-muted" title={title}>
          {title}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Badge variant="outline">{methodLabel}</Badge>
          {expense.paidFromRegister && <Badge variant="accent">De caja</Badge>}
        </div>
      </div>
      <p className="shrink-0 text-right text-base font-bold tabular-nums text-text">{formatPEN(expense.amountCents)}</p>
      <div className="flex shrink-0">
        <button
          type="button"
          onClick={() => onEdit(expense)}
          aria-label={`Editar gasto de ${formatPEN(expense.amountCents)}, ${title}`}
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-text-muted hover:bg-muted hover:text-text"
        >
          <Pencil aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(expense)}
          aria-label={`Eliminar gasto de ${formatPEN(expense.amountCents)}, ${title}`}
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-text-muted hover:bg-sky-soft hover:text-destructive"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      </div>
    </li>
  );
}

/** Gastos agrupados por día, cada día con su total. */
export function ExpenseList({ groups, categoriesById, categoriesReady, methods, onEdit, onDelete }: ExpenseListProps) {
  const methodLabels = new Map(methods.map((method) => [method.key, method.label]));
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.date} aria-labelledby={`day-${group.date}`}>
          <header className="flex items-baseline justify-between gap-3 border-b-2 border-border pb-2">
            <h3 id={`day-${group.date}`} className="font-display text-sm font-bold capitalize text-text">
              {formatDayHeading(group.date)}
            </h3>
            <p className="text-sm font-bold tabular-nums text-text-muted">
              <span className="sr-only">Total del día: </span>
              {formatPEN(group.totalCents)}
            </p>
          </header>
          <ul className="divide-y divide-border">
            {group.items.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                category={categoriesById.get(expense.categoryId)}
                categoriesReady={categoriesReady}
                methodLabel={methodLabels.get(expense.paymentMethod) ?? expense.paymentMethod}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
