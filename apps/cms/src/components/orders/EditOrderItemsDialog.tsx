import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Minus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { ORDER_ITEMS_MAX, type OrderDto, type OrderItemInput, type PaginatedResult, type Size } from '@sabor/shared';
import type { CategoryWithPrices, MenuItemDetailAdmin, MenuItemWithCover } from '../../lib/adminTypes';
import { useMutation } from '../../hooks/useMutation';
import { api } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { toastError, toastSuccess } from '../../store/toastStore';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { fieldClassName } from '../ui/FormField';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '../ui/dialog';

const SEARCH_DEBOUNCE_MS = 350;
const SEARCH_PAGE_SIZE = 8;
const QUANTITY_MIN = 1;

interface DraftLine {
  /** `${itemId}:${sizeId ?? 'none'}` — de-dup de líneas + key de React. */
  key: string;
  itemId: number;
  sizeId?: number;
  nameEs: string;
  sizeLabel: string | null;
  /** Solo para el subtotal en pantalla — nunca viaja al servidor, que siempre recalcula. */
  unitPrice: number;
  quantity: number;
}

function draftKey(itemId: number, sizeId?: number): string {
  return `${itemId}:${sizeId ?? 'none'}`;
}

/**
 * Semilla del draft a partir del pedido persistido. `OrderItem` no guarda
 * `sizeId` (solo el snapshot `sizeLabel`), así que se resuelve buscando el
 * tamaño activo cuyo label coincide. Si no matchea ninguno (tamaño
 * renombrado/eliminado después de que se hizo el pedido), la línea queda con
 * `sizeId: undefined` y se bloquea el guardado hasta que se quite y
 * reagregue — ver el guard en `handleSave`.
 */
function seedDraftLines(order: OrderDto, sizes: Size[]): DraftLine[] {
  return order.items
    // Defensivo: un pedido source='storefront' no debería tener líneas de
    // premio (itemId null), pero no se asume sin verificar.
    .filter((item): item is typeof item & { itemId: number } => item.itemId != null)
    .map((item) => {
      const sizeId = item.sizeLabel ? sizes.find((s) => s.labelEs === item.sizeLabel)?.id : undefined;
      return {
        key: draftKey(item.itemId, sizeId),
        itemId: item.itemId,
        sizeId,
        nameEs: item.nameEs,
        sizeLabel: item.sizeLabel,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      };
    });
}

interface EditOrderItemsDialogProps {
  order: OrderDto;
  /** Cargados una sola vez en `PedidosPage` y pasados por props — evita un fetch de catálogo por cada card. */
  categories: CategoryWithPrices[] | undefined;
  sizes: Size[] | undefined;
  /** Se llama tras guardar con éxito, para que el padre haga refetch (mismo callback que `OrderStatusActions`). */
  onUpdated: () => void;
}

/**
 * Editor de ítems de un pedido `pending` (P2.9): el cliente arma su pedido en
 * la web pero a veces lo cambia por WhatsApp antes de que el dueño lo
 * confirme — este diálogo deja buscar/agregar/quitar productos y ajustar
 * cantidades antes de aprobar. Solo debe montarse cuando el padre ya filtró
 * `order.status === 'pending' && order.source === 'storefront'`.
 */
export function EditOrderItemsDialog({ order, categories, sizes, onUpdated }: EditOrderItemsDialogProps) {
  const [open, setOpen] = useState(false);
  const ready = categories !== undefined && sizes !== undefined;
  // Ref (no state): un PUT en vuelo no debe poder cerrarse por Escape/click
  // afuera/botón X mientras está en curso — Radix enruta las 3 vías a
  // `onOpenChange`, así que basta con filtrar el intento de cierre aquí.
  const savingRef = useRef(false);

  function handleOpenChange(next: boolean) {
    if (!next && savingRef.current) return;
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm" disabled={!ready} className="w-full">
          <Pencil className="size-4" />
          Editar pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg gap-5 overflow-y-auto">
        {/* Se remonta cada vez que se abre (open && ...): siempre arranca desde
            el último pedido persistido, nunca desde un draft de una apertura anterior. */}
        {open && categories && sizes && (
          <EditOrderItemsForm
            order={order}
            categories={categories}
            sizes={sizes}
            onClose={() => setOpen(false)}
            onSaved={onUpdated}
            onSavingChange={(saving) => {
              savingRef.current = saving;
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EditOrderItemsFormProps {
  order: OrderDto;
  categories: CategoryWithPrices[];
  sizes: Size[];
  onClose: () => void;
  onSaved: () => void;
  onSavingChange: (saving: boolean) => void;
}

function EditOrderItemsForm({ order, categories, sizes, onClose, onSaved, onSavingChange }: EditOrderItemsFormProps) {
  const [draftLines, setDraftLines] = useState<DraftLine[]>(() => seedDraftLines(order, sizes));
  const [dirty, setDirty] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [results, setResults] = useState<MenuItemWithCover[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  // Búsqueda de productos con debounce — mismo patrón que MenuItemsPage/CollectionEditor,
  // + guard de `cancelled` para que una respuesta vieja (fuera de orden en la red) no
  // pise el resultado de una búsqueda más reciente.
  useEffect(() => {
    const term = searchInput.trim();
    if (!term) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(() => {
      api
        .get<PaginatedResult<MenuItemWithCover>>(
          `/menu-items?search=${encodeURIComponent(term)}&pageSize=${SEARCH_PAGE_SIZE}`,
        )
        .then((res) => {
          if (!cancelled) setResults(res.items);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [searchInput]);

  /**
   * Inserta o suma cantidad de forma atómica contra el `prev` que React le
   * pasa al updater (no contra el `draftLines` del closure, que puede estar
   * desactualizado si dos `handleAdd` quedan en vuelo a la vez — ej. el
   * usuario clickea un tamaño, y antes de que resuelva el fetch de precio
   * clickea otro tamaño del mismo ítem, lo que reactiva el botón del primero
   * y permite un tercer click sobre la MISMA key mientras la primera sigue
   * pendiente). Sin esto, dos altas concurrentes de la misma key podían
   * terminar en dos `DraftLine` con el mismo `key` (colisión de key de
   * React, y `removeLine`/`setQuantity` afectando a ambas a la vez).
   */
  function upsertDraftLine(newLine: DraftLine) {
    let capped = false;
    setDraftLines((prev) => {
      const existing = prev.find((l) => l.key === newLine.key);
      if (existing) return prev.map((l) => (l.key === newLine.key ? { ...l, quantity: l.quantity + 1 } : l));
      if (prev.length >= ORDER_ITEMS_MAX) {
        capped = true;
        return prev;
      }
      return [...prev, newLine];
    });
    if (capped) {
      toastError(`Máximo ${ORDER_ITEMS_MAX} productos por pedido`);
      return;
    }
    setDirty(true);
  }

  async function handleAdd(item: MenuItemWithCover, sizeId: number | undefined) {
    const key = draftKey(item.id, sizeId);

    if (sizeId == null) {
      if (item.price == null) {
        toastError(`"${item.nameEs}" no tiene un precio configurado`);
        return;
      }
      upsertDraftLine({ key, itemId: item.id, sizeId: undefined, nameEs: item.nameEs, sizeLabel: null, unitPrice: item.price, quantity: 1 });
      return;
    }

    const size = sizes.find((s) => s.id === sizeId);
    if (!size) return;

    setAddingKey(key);
    try {
      // El buscador no trae precio por tamaño — se resuelve recién al agregar
      // (con overrides incluidos) para no reimplementar la lógica de pricing aquí.
      const detail = await api.get<MenuItemDetailAdmin>(`/menu-items/${item.id}`);
      const resolved = detail.prices.find((p) => p.sizeId === sizeId);
      if (!resolved) {
        toastError(`No hay precio configurado para "${item.nameEs}" en ${size.labelEs}`);
        return;
      }
      upsertDraftLine({ key, itemId: item.id, sizeId, nameEs: item.nameEs, sizeLabel: size.labelEs, unitPrice: resolved.price, quantity: 1 });
    } catch {
      toastError('No se pudo cargar el precio de ese producto');
    } finally {
      setAddingKey(null);
    }
  }

  function removeLine(key: string) {
    setDraftLines((prev) => prev.filter((l) => l.key !== key));
    setDirty(true);
  }

  function setQuantity(key: string, quantity: number) {
    setDraftLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity } : l)));
    setDirty(true);
  }

  const { mutate: save, loading: saving } = useMutation(() =>
    api.put<OrderDto>(`/orders/${order.id}/items`, {
      items: draftLines.map((l): OrderItemInput => ({ itemId: l.itemId, sizeId: l.sizeId, quantity: l.quantity })),
    }),
  );

  useEffect(() => {
    onSavingChange(saving);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `onSavingChange` es un setter de ref estable, no hace falta declararlo.
  }, [saving]);

  // Un pedido storefront no debería tener líneas sin itemId (esas son de
  // canje de premio), pero si igual ocurriera, el guardado es un reemplazo
  // TOTAL del set de order_items — no se guarda en silencio, se bloquea.
  const hasUnsupportedLines = order.items.some((item) => item.itemId == null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (hasUnsupportedLines) {
      toastError('Este pedido tiene líneas que no se pueden editar aquí — no se puede guardar sin perderlas.');
      return;
    }
    if (draftLines.length === 0) {
      toastError('El pedido necesita al menos un producto. Para vaciarlo, usa "Cancelar" en la card del pedido.');
      return;
    }
    if (draftLines.some((l) => l.sizeLabel && l.sizeId == null)) {
      toastError('Hay un producto con un tamaño no reconocido: quitalo y agregalo de nuevo antes de guardar.');
      return;
    }
    const result = await save();
    if (result !== undefined) {
      toastSuccess('Pedido actualizado');
      onSaved();
      onClose();
    }
  }

  const total = draftLines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  return (
    <>
      <div>
        <DialogTitle>Editar pedido #{order.code}</DialogTitle>
        <DialogDescription>
          Confirma qué quiere el cliente antes de aprobar. Los precios se recalculan al guardar.
        </DialogDescription>
      </div>

      {hasUnsupportedLines && (
        <p className="rounded-xl border-2 border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive">
          Este pedido tiene productos que no se pueden editar aquí. No se puede guardar sin perderlos — contacta soporte.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            aria-label="Buscar productos para agregar"
            placeholder="Buscar producto por nombre…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={cn(fieldClassName, 'pl-10')}
          />
        </div>
        {searchInput.trim() && (
          <div className="max-h-52 overflow-y-auto rounded-xl border-2 border-border bg-surface">
            {searching && <p className="p-3 text-sm text-text-muted">Buscando…</p>}
            {!searching && results.length === 0 && <p className="p-3 text-sm text-text-muted">Sin resultados.</p>}
            {!searching &&
              results.map((item) => (
                <SearchResultRow
                  key={item.id}
                  item={item}
                  hasSizes={categoryById.get(item.categoryId)?.hasSizes ?? false}
                  sizes={sizes}
                  addingKey={addingKey}
                  onAdd={(sizeId) => handleAdd(item, sizeId)}
                />
              ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">
          Productos del pedido ({draftLines.length}/{ORDER_ITEMS_MAX})
        </p>
        {draftLines.length === 0 && (
          <p className="rounded-xl border-2 border-dashed border-border p-4 text-sm text-text-muted">
            Sin productos. Busca arriba para agregar.
          </p>
        )}
        <ul className="flex flex-col gap-1.5">
          {draftLines.map((line) => (
            <li key={line.key} className="flex items-center gap-2 rounded-xl border-2 border-border p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">
                  {line.nameEs}
                  {line.sizeLabel && <span className="text-text-muted"> ({line.sizeLabel})</span>}
                </p>
                {line.sizeLabel && line.sizeId == null ? (
                  <p className="text-xs font-medium text-destructive">Tamaño no reconocido — quitalo y agregalo de nuevo</p>
                ) : (
                  <p className="text-xs text-text-muted">{formatPrice(line.unitPrice)} c/u</p>
                )}
              </div>
              <QuantityStepper value={line.quantity} label={`Cantidad de ${line.nameEs}`} onChange={(next) => setQuantity(line.key, next)} />
              <button
                type="button"
                onClick={() => removeLine(line.key)}
                aria-label={`Quitar ${line.nameEs} del pedido`}
                className="shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={handleSave} className="flex items-center justify-between gap-4 border-t border-border pt-3">
        <div>
          <p className="text-xs text-text-muted">Subtotal estimado</p>
          <p className="text-lg font-bold tabular-nums text-text">{formatPrice(total)}</p>
        </div>
        <Button type="submit" loading={saving} disabled={!dirty || hasUnsupportedLines}>
          Guardar cambios
        </Button>
      </form>
    </>
  );
}

interface SearchResultRowProps {
  item: MenuItemWithCover;
  hasSizes: boolean;
  sizes: Size[];
  addingKey: string | null;
  onAdd: (sizeId: number | undefined) => void;
}

/** Mini-card de resultado de búsqueda: solo el nombre (sin foto) y el/los control/es para agregar. */
function SearchResultRow({ item, hasSizes, sizes, addingKey, onAdd }: SearchResultRowProps) {
  if (!hasSizes) {
    const key = draftKey(item.id);
    return (
      <button
        type="button"
        onClick={() => onAdd(undefined)}
        disabled={addingKey === key}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text transition-colors hover:bg-muted disabled:opacity-40"
      >
        <Plus className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate">{item.nameEs}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm text-text">{item.nameEs}</span>
      {sizes.map((size) => {
        const key = draftKey(item.id, size.id);
        return (
          <button
            key={size.id}
            type="button"
            onClick={() => onAdd(size.id)}
            disabled={addingKey === key}
            aria-label={`Agregar ${item.nameEs} en tamaño ${size.labelEs}`}
            className="shrink-0 rounded-full border-2 border-border px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-text transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
          >
            {size.labelEs}
          </button>
        );
      })}
    </div>
  );
}

interface QuantityStepperProps {
  value: number;
  label: string;
  onChange: (next: number) => void;
}

/** Contador +/- compacto para la cantidad de una línea del draft (botones de 32px: fila densa, no el mínimo táctil de 44px de un CTA). */
function QuantityStepper({ value, label, onChange }: QuantityStepperProps) {
  return (
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        disabled={value <= QUANTITY_MIN}
        onClick={() => onChange(value - 1)}
        aria-label={`Bajar cantidad — ${label}`}
        className="flex size-8 items-center justify-center rounded-lg border-2 border-border text-text transition-colors hover:border-primary disabled:opacity-30"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="w-6 text-center text-sm font-bold tabular-nums text-text">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label={`Subir cantidad — ${label}`}
        className="flex size-8 items-center justify-center rounded-lg border-2 border-border text-text transition-colors hover:border-primary"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
