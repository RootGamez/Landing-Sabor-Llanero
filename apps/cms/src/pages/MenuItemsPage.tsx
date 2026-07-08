import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import type { MenuItemWithCover } from '../lib/adminTypes';
import { useCategories, useMenuItems } from '../hooks/useCmsData';
import { useMutation } from '../hooks/useMutation';
import { api } from '../lib/api';
import { toastSuccess } from '../store/toastStore';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { fieldClassName } from '../components/ui/FormField';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { MenuItemAdminCard } from '../components/menu-items/MenuItemAdminCard';

const SEARCH_DEBOUNCE_MS = 350;

export function MenuItemsPage() {
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Debounce de la búsqueda para no disparar un fetch por tecla.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const { data: categories } = useCategories();
  const { data: result, loading, error, refetch } = useMenuItems({ categoryId, search, page });
  const { mutate: remove } = useMutation((id: number) => api.delete(`/menu-items/${id}`));

  const categoryById = new Map(categories?.map((c) => [c.id, c]) ?? []);

  async function handleDelete(item: MenuItemWithCover) {
    if (!window.confirm(`¿Eliminar "${item.nameEs}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(item.id);
    const res = await remove(item.id);
    setDeletingId(null);
    if (res !== undefined) {
      toastSuccess('Ítem eliminado');
      refetch();
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Menú</h1>
          <p className="text-sm text-text-muted">Pizzas, entradas, bebidas y promos del catálogo.</p>
        </div>
        <Button asChild variant="accent">
          <Link to="/menu/nuevo">
            <Plus className="size-4" />
            Nuevo ítem
          </Link>
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          aria-label="Buscar ítems"
          placeholder="Buscar por nombre (es/en)…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className={cn(fieldClassName, 'pl-10')}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <FilterChip
          label="Todas"
          active={categoryId === undefined}
          onClick={() => {
            setCategoryId(undefined);
            setPage(1);
          }}
        />
        {categories?.map((c) => (
          <FilterChip
            key={c.id}
            label={c.nameEs}
            active={categoryId === c.id}
            onClick={() => {
              setCategoryId(c.id);
              setPage(1);
            }}
          />
        ))}
      </div>

      <div>
        {loading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={`skeleton-${i}`} className="aspect-[3/4] w-full rounded-xl2" />
            ))}
          </div>
        )}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {!loading && !error && result && result.items.length === 0 && (
          <EmptyState title="No hay ítems" description="Creá el primero con el botón de arriba." />
        )}
        {!loading && !error && result && result.items.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {result.items.map((item) => {
              const category = categoryById.get(item.categoryId);
              return (
                <MenuItemAdminCard
                  key={item.id}
                  item={item}
                  categoryName={category?.nameEs}
                  categoryHasSizes={category?.hasSizes}
                  onDelete={handleDelete}
                  deleting={deletingId === item.id}
                />
              );
            })}
          </div>
        )}

        {result && result.total > result.pageSize && (
          <div className="mt-6 flex items-center justify-center gap-4">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span className="text-sm text-text-muted">
              Página {result.page} de {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border-2 px-4 py-1.5 text-sm font-bold font-display uppercase tracking-wide transition-all active:scale-95',
        active
          ? 'border-forest bg-primary text-primary-foreground shadow-sticker-lime'
          : 'border-border bg-surface text-text hover:border-forest'
      )}
    >
      {label}
    </button>
  );
}
