import { useMemo, useState } from 'react';
import { formatPEN, type Expense } from '@sabor/shared';
import { ConfirmDialog } from '../components/expenses/ConfirmDialog';
import { ExpenseEditDialog } from '../components/expenses/ExpenseEditDialog';
import { ExpenseFiltersBar } from '../components/expenses/ExpenseFiltersBar';
import { ExpenseList } from '../components/expenses/ExpenseList';
import { ExpenseQuickForm } from '../components/expenses/ExpenseQuickForm';
import { flattenCategories, groupByDay, presetRange } from '../components/expenses/expenseUtils';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { TableSkeleton } from '../components/ui/Skeleton';
import {
  useActivePaymentMethods,
  useDebouncedValue,
  useExpenseCategories,
  useExpenseList,
  useHasOpenCash,
} from '../hooks/useExpenses';
import { useMutation } from '../hooks/useMutation';
import { deleteExpense, type ExpenseFilterValues } from '../lib/expensesApi';
import { toastSuccess } from '../store/toastStore';

const PAGE_SIZE = 50;

function initialFilters(): ExpenseFilterValues {
  return { ...presetRange('month'), categoryId: null, paymentMethod: '', q: '' };
}

export function ExpensesPage() {
  const [filters, setFilters] = useState<ExpenseFilterValues>(initialFilters);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const debouncedSearch = useDebouncedValue(searchText);
  const effectiveFilters = useMemo(() => ({ ...filters, q: debouncedSearch }), [filters, debouncedSearch]);

  const categoriesState = useExpenseCategories();
  const methodsState = useActivePaymentMethods();
  const openCashState = useHasOpenCash();
  const list = useExpenseList(effectiveFilters, page, PAGE_SIZE);
  const { mutate: remove, loading: removing } = useMutation(deleteExpense);

  const categories = useMemo(() => flattenCategories(categoriesState.data ?? []), [categoriesState.data]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const methods = methodsState.data ?? [];
  const groups = useMemo(() => groupByDay(list.data?.items ?? [], list.data?.dayTotals ?? []), [list.data]);

  function changeFilters(patch: Partial<ExpenseFilterValues>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function changeSearch(text: string) {
    setSearchText(text);
    setPage(1);
  }

  function refreshAll() {
    list.refetch();
    categoriesState.refetch();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const result = await remove(deleting.id);
    if (result === undefined) return;
    toastSuccess('Gasto eliminado');
    setDeleting(null);
    // Si era el único de la última página, volver a la anterior (si no, queda "Página 3 de 2" vacía).
    if (list.data?.items.length === 1 && page > 1) setPage(page - 1);
    refreshAll();
  }

  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Gastos</h1>
        <p className="text-sm text-text-muted">Anota una compra o un pago en segundos y revisa a dónde se va el dinero.</p>
      </div>

      {categoriesState.error || methodsState.error ? (
        <ErrorState
          message={categoriesState.error ?? methodsState.error ?? ''}
          onRetry={() => {
            categoriesState.refetch();
            methodsState.refetch();
          }}
        />
      ) : null}
      {/* El formulario sigue montado aunque falle un refetch: no se pierde lo que se estaba escribiendo. */}
      <ExpenseQuickForm
        categories={categories}
        methods={methods}
        hasOpenCash={openCashState.data ?? false}
        onSaved={refreshAll}
      />

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ExpenseFiltersBar
            filters={filters}
            searchText={searchText}
            categories={categories}
            methods={methods}
            onChange={changeFilters}
            onSearchTextChange={changeSearch}
          />

          {list.data || list.loading ? (
            <p role="status" aria-live="polite" className="rounded-xl bg-muted px-4 py-3 text-sm text-text">
              {list.data ? (
                <>
                  <span className="font-bold tabular-nums">{formatPEN(list.data.totalCents)}</span> en {list.data.total}{' '}
                  {list.data.total === 1 ? 'gasto' : 'gastos'} con estos filtros
                </>
              ) : (
                'Calculando total…'
              )}
            </p>
          ) : null}

          {list.loading && !list.data ? <TableSkeleton rows={6} /> : null}
          {list.error ? <ErrorState message={list.error} onRetry={list.refetch} /> : null}
          {list.data && groups.length === 0 ? (
            <EmptyState title="No hay gastos con estos filtros" description="Registra uno arriba o cambia el rango de fechas." />
          ) : null}
          {groups.length > 0 ? (
            <ExpenseList groups={groups} categoriesById={categoriesById} categoriesReady={categoriesState.data !== undefined} methods={methods} onEdit={setEditing} onDelete={setDeleting} />
          ) : null}

          {totalPages > 1 && (
            <nav aria-label="Paginación" className="flex items-center justify-between gap-3">
              <Button variant="outline" size="sm" className="h-11" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Anterior
              </Button>
              <span className="text-sm text-text-muted">
                Página {page} de {totalPages}
              </span>
              <Button variant="outline" size="sm" className="h-11" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Siguiente
              </Button>
            </nav>
          )}
        </CardContent>
      </Card>

      {editing && (
        <ExpenseEditDialog
          key={editing.id}
          expense={editing}
          categories={categories}
          methods={methods}
          hasOpenCash={openCashState.data ?? false}
          onClose={() => setEditing(null)}
          onSaved={refreshAll}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="¿Eliminar este gasto?"
        description={
          deleting
            ? `Se quitará el gasto de ${formatPEN(deleting.amountCents)}${deleting.paidFromRegister ? ' y se devolverá ese efectivo al cálculo de la caja' : ''}.`
            : ''
        }
        confirmLabel="Eliminar"
        loading={removing}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
