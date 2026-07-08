import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Search, Trash2 } from 'lucide-react';
import type { CollectionWithItems, MenuItemWithPrices, PaginatedResult } from '@sabor/shared';
import type { MenuItemWithCover } from '../../lib/adminTypes';
import { api } from '../../lib/api';
import { formatPrice, mediaUrl } from '../../lib/format';
import { useMutation } from '../../hooks/useMutation';
import { toastError, toastSuccess } from '../../store/toastStore';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { TextField, fieldClassName } from '../ui/FormField';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

const COLLECTION_ITEMS_MAX = 20;
const SEARCH_DEBOUNCE_MS = 350;
const SEARCH_PAGE_SIZE = 8;

interface CollectionEditorProps {
  collection: CollectionWithItems;
  /** Conteo de order_clicks por itemId (reporte), para ayudar a decidir qué destacar. */
  clicksByItem: Map<number, number>;
  onChange: () => void;
}

/**
 * Editor de UNA colección de merchandising (top_sellers / daily_featured /
 * promos): títulos bilingües + activo (PATCH /collections/:key) y curaduría
 * de ítems — buscar/agregar, reordenar, quitar — que se guarda completa con
 * PUT /collections/:key/items (máx. 20).
 */
export function CollectionEditor({ collection, clicksByItem, onChange }: CollectionEditorProps) {
  const [titleEs, setTitleEs] = useState(collection.titleEs);
  const [titleEn, setTitleEn] = useState(collection.titleEn);
  const [isActive, setIsActive] = useState(collection.isActive);

  const [items, setItems] = useState<MenuItemWithPrices[]>(collection.items);
  const [dirtyItems, setDirtyItems] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [results, setResults] = useState<MenuItemWithCover[]>([]);
  const [searching, setSearching] = useState(false);

  // Resincroniza al refrescar los datos desde el servidor.
  useEffect(() => {
    setTitleEs(collection.titleEs);
    setTitleEn(collection.titleEn);
    setIsActive(collection.isActive);
    setItems(collection.items);
    setDirtyItems(false);
  }, [collection]);

  // Búsqueda de ítems del menú para agregar, con debounce.
  useEffect(() => {
    const term = searchInput.trim();
    if (!term) {
      setResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      api
        .get<PaginatedResult<MenuItemWithCover>>(
          `/menu-items?search=${encodeURIComponent(term)}&pageSize=${SEARCH_PAGE_SIZE}`,
        )
        .then((res) => setResults(res.items))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const { mutate: saveMeta, loading: savingMeta } = useMutation(() =>
    api.patch(`/collections/${collection.key}`, { titleEs, titleEn, isActive }),
  );
  const { mutate: saveItems, loading: savingItems } = useMutation(() =>
    api.put<CollectionWithItems>(`/collections/${collection.key}/items`, {
      items: items.map((item, index) => ({ itemId: item.id, displayOrder: index })),
    }),
  );

  async function handleSaveMeta(e: FormEvent) {
    e.preventDefault();
    if (!titleEs.trim()) {
      toastError('El título en español es requerido');
      return;
    }
    const result = await saveMeta();
    if (result !== undefined) {
      toastSuccess('Colección actualizada');
      onChange();
    }
  }

  async function handleSaveItems() {
    const result = await saveItems();
    if (result !== undefined) {
      toastSuccess('Ítems de la colección guardados');
      onChange();
    }
  }

  function addItem(item: MenuItemWithCover) {
    if (items.some((i) => i.id === item.id)) {
      toastError('Ese ítem ya está en la colección');
      return;
    }
    if (items.length >= COLLECTION_ITEMS_MAX) {
      toastError(`Máximo ${COLLECTION_ITEMS_MAX} ítems por colección`);
      return;
    }
    // Shape mínimo compatible con MenuItemWithPrices para la lista local; el
    // PUT solo envía itemId + displayOrder y el server devuelve el shape real.
    setItems((prev) => [...prev, { ...item, prices: [] }]);
    setDirtyItems(true);
    setSearchInput('');
    setResults([]);
  }

  function removeItem(itemId: number) {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setDirtyItems(true);
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const a = next[index]!;
      next[index] = next[target]!;
      next[target] = a;
      return next;
    });
    setDirtyItems(true);
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          {collection.titleEs}
          <Badge variant={isActive ? 'success' : 'muted'}>{isActive ? 'Activa' : 'Inactiva'}</Badge>
        </CardTitle>
        <code className="text-xs text-text-muted">{collection.key}</code>
      </CardHeader>
      <CardContent className="gap-5">
        {/* Títulos + activo */}
        <form onSubmit={handleSaveMeta} className="flex flex-col gap-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Título (español)"
              required
              value={titleEs}
              onChange={(e) => setTitleEs(e.target.value)}
            />
            <TextField
              label="Título (inglés)"
              hint="Vacío = se muestra el título en español."
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="size-5 accent-primary"
              />
              Visible en el catálogo
            </label>
            <Button type="submit" size="sm" loading={savingMeta}>
              Guardar título
            </Button>
          </div>
        </form>

        {/* Lista curada */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">
            Ítems ({items.length}/{COLLECTION_ITEMS_MAX})
          </p>
          {items.length === 0 && (
            <p className="rounded-xl border-2 border-dashed border-border p-4 text-sm text-text-muted">
              Sin ítems todavía. Buscá abajo para agregar.
            </p>
          )}
          <ul className="flex flex-col gap-1.5">
            {items.map((item, index) => {
              const clicks = clicksByItem.get(item.id);
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border-2 border-border bg-surface p-2"
                >
                  {item.coverImageKey ? (
                    <img
                      src={mediaUrl(item.coverImageKey)}
                      alt=""
                      className="size-10 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="size-10 shrink-0 rounded-lg bg-muted" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text">
                      {item.nameEs}
                      {!item.isActive && (
                        <Badge variant="muted" className="ml-2">
                          Inactivo
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-text-muted">
                      {item.price != null ? formatPrice(item.price) : 'Precio por tamaño'}
                      {clicks != null && ` · ${clicks} pedido${clicks === 1 ? '' : 's'} (clics)`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveItem(index, -1)}
                      aria-label={`Subir ${item.nameEs}`}
                      className="rounded-lg p-1.5 text-text-muted transition-colors hover:text-primary disabled:opacity-30"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === items.length - 1}
                      onClick={() => moveItem(index, 1)}
                      aria-label={`Bajar ${item.nameEs}`}
                      className="rounded-lg p-1.5 text-text-muted transition-colors hover:text-primary disabled:opacity-30"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Quitar ${item.nameEs}`}
                      className="rounded-lg p-1.5 text-text-muted transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Buscador para agregar */}
          <div className="relative mt-1 max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              aria-label={`Buscar ítems para agregar a ${collection.titleEs}`}
              placeholder="Buscar ítem del menú para agregar…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={cn(fieldClassName, 'pl-10')}
            />
            {searchInput.trim() && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border-2 border-border bg-surface shadow-lg">
                {searching && <p className="p-3 text-sm text-text-muted">Buscando…</p>}
                {!searching && results.length === 0 && (
                  <p className="p-3 text-sm text-text-muted">Sin resultados.</p>
                )}
                {!searching &&
                  results.map((r) => {
                    const clicks = clicksByItem.get(r.id);
                    const already = items.some((i) => i.id === r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        disabled={already}
                        onClick={() => addItem(r)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text transition-colors hover:bg-muted disabled:opacity-40"
                      >
                        <Plus className="size-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate">{r.nameEs}</span>
                        {clicks != null && (
                          <span className="shrink-0 text-xs text-text-muted">{clicks} clics</span>
                        )}
                        {already && <span className="shrink-0 text-xs text-text-muted">Ya agregado</span>}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          <Button
            type="button"
            size="sm"
            loading={savingItems}
            disabled={!dirtyItems}
            onClick={handleSaveItems}
            className="mt-2 self-start"
          >
            <Save className="size-4" />
            Guardar ítems
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
