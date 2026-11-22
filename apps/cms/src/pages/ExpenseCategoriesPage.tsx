import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { ExpenseCategoryNode } from '@sabor/shared';
import { CategoryDialog, type CategoryDialogTarget } from '../components/expenses/CategoryDialog';
import { CategoryRow } from '../components/expenses/CategoryRow';
import { ConfirmDialog } from '../components/expenses/ConfirmDialog';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { TableSkeleton } from '../components/ui/Skeleton';
import { useExpenseCategories } from '../hooks/useExpenses';
import { useMutation } from '../hooks/useMutation';
import { deleteExpenseCategory, updateExpenseCategory } from '../lib/expensesApi';
import { toastSuccess } from '../store/toastStore';

export function ExpenseCategoriesPage() {
  const { data: roots, loading, error, refetch } = useExpenseCategories();
  const [dialog, setDialog] = useState<CategoryDialogTarget | null>(null);
  const [deleting, setDeleting] = useState<ExpenseCategoryNode | null>(null);

  const { mutate: toggle } = useMutation((node: ExpenseCategoryNode) =>
    updateExpenseCategory(node.id, { isActive: !node.isActive }),
  );
  const { mutate: remove, loading: removing } = useMutation(deleteExpenseCategory);

  async function toggleActive(node: ExpenseCategoryNode) {
    if ((await toggle(node)) === undefined) return;
    toastSuccess(node.isActive ? 'Categoría desactivada' : 'Categoría activada');
    refetch();
  }

  async function confirmDelete() {
    if (!deleting) return;
    if ((await remove(deleting.id)) === undefined) return;
    toastSuccess('Categoría eliminada');
    setDeleting(null);
    refetch();
  }

  const rowActions = {
    onEdit: (node: ExpenseCategoryNode) => setDialog({ editing: node, parentId: null }),
    onToggleActive: toggleActive,
    onDelete: setDeleting,
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Categorías de gastos</h1>
          <p className="text-sm text-text-muted">
            Organiza tus gastos para entender en qué se va el dinero. Desactiva las que ya no uses en lugar de eliminarlas.
          </p>
        </div>
        <Button variant="accent" onClick={() => setDialog({ editing: null, parentId: null })}>
          <Plus aria-hidden="true" />
          Nueva categoría
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading && !roots ? <TableSkeleton rows={6} /> : null}
          {error ? <ErrorState message={error} onRetry={refetch} /> : null}
          {roots && roots.length === 0 ? (
            <EmptyState title="Aún no hay categorías" description="Crea la primera para empezar a clasificar tus gastos." />
          ) : null}
          {roots && roots.length > 0 ? (
            <ul className="divide-y divide-border">
              {roots.map((root) => (
                <li key={root.id} className="list-none">
                  <ul>
                    <CategoryRow
                      node={root}
                      isChild={false}
                      onAddChild={(node) => setDialog({ editing: null, parentId: node.id })}
                      {...rowActions}
                    />
                    {root.children.map((child) => (
                      <CategoryRow key={child.id} node={child} isChild {...rowActions} />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {dialog && (
        <CategoryDialog
          key={dialog.editing?.id ?? `new-${dialog.parentId ?? 'root'}`}
          target={dialog}
          roots={roots ?? []}
          onClose={() => setDialog(null)}
          onSaved={refetch}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="¿Eliminar esta categoría?"
        description={deleting ? `Se eliminará "${deleting.name}". Esta acción no se puede deshacer.` : ''}
        confirmLabel="Eliminar"
        loading={removing}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
