import { useId, useMemo, useState, type ComponentProps } from 'react';
import { ArrowLeft, Check, Lock, Search, X } from 'lucide-react';
import { MAX_FLAVORS_PER_PIZZA, formatPEN, type FlavorTarget, type SaleItemFlavors } from '@sabor/shared';
import {
  fixedFlavor,
  flavorGroups,
  initialSelection,
  livePrice,
  nextActivePizza,
  removeFlavor,
  searchFlavors,
  toggleFlavor,
  type FlavorGroup,
  type FlavorOption,
} from '../../lib/flavorSelection';
import { flavorCatalogOf, flavorTargetOf, type PosCatalog, type PosProduct } from '../../lib/posCatalog';
import { cn } from '../../lib/utils';
import { usePosCatalogStore } from '../../store/posCatalogStore';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { CategoryGrid } from './CategoryGrid';
import { PosModal } from './PosModal';
import { toneFor } from './categoryColors';
import { TILE_BASE_CLASS, TILE_GRID_CLASS } from './tileStyles';

export interface FlavorChoice {
  flavors: number[][];
  flavorInfo: SaleItemFlavors;
  unitPriceCents: number;
}

/** Qué se edita: un producto (pizza en un tamaño o promo) y su selección actual. */
export interface FlavorRequest {
  product: PosProduct;
  sizeId: number | null;
  initial: number[][] | null;
}

interface FlavorPickerProps {
  request: FlavorRequest | null;
  /** "Agregar al ticket" (promo nueva) o "Listo" (editar una línea). */
  confirmLabel: string;
  onConfirm: (choice: FlavorChoice) => void;
  onClose: () => void;
}

/**
 * Selector de sabores MOBILE-FIRST: hoja inferior alta en el celular (una
 * mano, botones ≥44px, "Listo" fijo abajo) y diálogo centrado desde `sm`.
 * Los sabores y el precio salen del catálogo ya cargado: no usa la red.
 */
export function FlavorPicker({ request, confirmLabel, onConfirm, onClose }: FlavorPickerProps) {
  const catalog = usePosCatalogStore((s) => s.catalog);
  const error = usePosCatalogStore((s) => s.error);
  const retry = usePosCatalogStore((s) => s.retry);
  const target = request && catalog ? flavorTargetOf(request.product, request.sizeId) : null;
  const sizeLabel = request?.product.promo?.sizeLabel ?? request?.product.options.find((o) => o.sizeId === request.sizeId)?.label ?? '';
  const modal = {
    open: request !== null,
    onOpenChange: (open: boolean) => !open && onClose(),
    placement: 'sheet' as const,
    title: request ? `Sabores · ${request.product.name}${sizeLabel ? ` (${sizeLabel})` : ''}` : 'Sabores',
    description: request?.product.promo
      ? `Hasta ${MAX_FLAVORS_PER_PIZZA} sabores por pizza. Las Clásicas no suman; otras categorías suman la diferencia.`
      : `Hasta ${MAX_FLAVORS_PER_PIZZA} sabores: se cobra el sabor más caro en el mismo tamaño.`,
  };

  if (request && catalog && target) {
    return (
      <PickerBody
        key={`${request.product.id}:${request.sizeId ?? 0}`}
        modal={modal}
        catalog={catalog}
        target={target}
        initial={request.initial}
        confirmLabel={confirmLabel}
        onConfirm={onConfirm}
      />
    );
  }
  return (
    <PosModal {...modal}>
      {request && !catalog && (
        <ErrorState
          message={error ? 'No se pudo cargar la carta para elegir sabores. Revisa la conexión.' : 'La carta todavía se está cargando…'}
          onRetry={retry ?? undefined}
        />
      )}
      {request && catalog && !target && (
        <EmptyState title="Este producto no admite sabores" description="Configura la promo (pizzas y tamaño) en Menú." />
      )}
    </PosModal>
  );
}

interface PickerBodyProps {
  modal: Omit<ComponentProps<typeof PosModal>, 'children' | 'footer'>;
  catalog: PosCatalog;
  target: FlavorTarget;
  initial: number[][] | null;
  confirmLabel: string;
  onConfirm: (choice: FlavorChoice) => void;
}

function PickerBody({ modal, catalog, target, initial, confirmLabel, onConfirm }: PickerBodyProps) {
  const searchId = useId();
  const [selection, setSelection] = useState(() => initialSelection(target, initial));
  const [active, setActive] = useState(() => nextActivePizza(initialSelection(target, initial), 0));
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const fixed = fixedFlavor(target);

  const groups = useMemo(() => flavorGroups(flavorCatalogOf(catalog), catalog.categories, target.sizeId), [catalog, target.sizeId]);
  const nameById = useMemo(
    () => new Map(groups.flatMap((g) => g.options.map((o) => [o.itemId, o.name] as const))),
    [groups],
  );
  const price = livePrice(target, selection, flavorCatalogOf(catalog));
  const activePizza = selection[active] ?? [];

  function pick(option: FlavorOption) {
    const next = toggleFlavor(selection, active, option.itemId, fixed);
    setSelection(next);
    const following = nextActivePizza(next, active);
    if (following !== active) {
      setActive(following);
      setCategoryId(null);
      setQuery('');
    }
  }

  function confirm() {
    if (!price.ok) return;
    onConfirm({
      flavors: selection.map((pizza) => [...pizza]),
      flavorInfo: { kind: target.kind, pizzas: price.result.pizzas },
      unitPriceCents: price.result.unitPriceCents,
    });
  }

  const footer = (
    <>
      <PriceSummary price={price} />
      <Button size="lg" className="mt-2 h-14 w-full text-lg" disabled={!price.ok} onClick={confirm}>
        {price.ok ? `${confirmLabel} · ${formatPEN(price.result.unitPriceCents)}` : confirmLabel}
      </Button>
    </>
  );

  return (
    <PosModal {...modal} footer={footer}>
    <div className="flex flex-col gap-3">
      {selection.length > 1 && (
        <div role="group" aria-label="Pizzas de la promo" className="grid grid-cols-2 gap-2">
          {selection.map((pizza, index) => (
            <button
              key={index}
              type="button"
              aria-pressed={index === active}
              onClick={() => setActive(index)}
              className={cn(
                'flex min-h-14 flex-col items-start justify-center rounded-xl border-2 px-3 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
                index === active ? 'border-forest bg-lime-soft shadow-sticker' : 'border-border bg-surface',
              )}
            >
              <span className="text-sm font-bold text-text">Pizza {index + 1}</span>
              <span className="line-clamp-1 text-xs text-text-muted">
                {pizza.length > 0 ? pizza.map((id) => nameById.get(id) ?? '?').join(' / ') : 'Sin elegir'}
              </span>
            </button>
          ))}
        </div>
      )}

      <ChosenFlavors
        pizzaLabel={selection.length > 1 ? `Pizza ${active + 1}` : 'Tu pizza'}
        flavors={activePizza}
        fixed={fixed}
        nameById={nameById}
        onRemove={(id) => setSelection(removeFlavor(selection, active, id, fixed))}
      />

      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          Buscar sabor
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar sabor (ej. hawaiana)"
          autoComplete="off"
          enterKeyHint="search"
          className="h-12 w-full rounded-xl border-2 border-border bg-surface pl-10 pr-3 text-base text-text outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
        />
      </div>

      <FlavorBrowser
        groups={groups}
        query={query}
        categoryId={categoryId}
        onCategory={setCategoryId}
        selected={activePizza}
        isPromo={target.kind === 'promo'}
        onPick={pick}
      />
    </div>
    </PosModal>
  );
}

interface ChosenFlavorsProps {
  pizzaLabel: string;
  flavors: readonly number[];
  fixed: number | null;
  nameById: ReadonlyMap<number, string>;
  onRemove: (itemId: number) => void;
}

function ChosenFlavors({ pizzaLabel, flavors, fixed, nameById, onRemove }: ChosenFlavorsProps) {
  const step = Math.min(flavors.length + 1, MAX_FLAVORS_PER_PIZZA);
  const full = flavors.length >= MAX_FLAVORS_PER_PIZZA;
  return (
    <section aria-label={`Sabores de ${pizzaLabel}`} className="flex flex-col gap-2 rounded-xl border-2 border-border bg-card p-3">
      <p className="flex items-center justify-between gap-2 text-sm font-bold text-text" aria-live="polite">
        <span>{pizzaLabel}</span>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs tabular-nums">
          {full ? `${MAX_FLAVORS_PER_PIZZA} de ${MAX_FLAVORS_PER_PIZZA} sabores` : `Sabor ${step} de ${MAX_FLAVORS_PER_PIZZA}`}
        </span>
      </p>
      {flavors.length === 0 ? (
        <p className="text-sm text-text-muted">Toca un sabor de la lista.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {flavors.map((id) => {
            const name = nameById.get(id) ?? `Sabor ${id}`;
            return (
              <li key={id}>
                {id === fixed ? (
                  <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-forest bg-lime-soft px-3 text-sm font-bold text-text">
                    <Lock className="size-4" aria-hidden="true" />
                    {name}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRemove(id)}
                    aria-label={`Quitar ${name}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-forest bg-sky-soft pl-3 pr-2 text-sm font-bold text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {name}
                    <X className="size-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {full && <p className="text-xs text-text-muted">Tocar otro sabor reemplaza el último elegido.</p>}
    </section>
  );
}

interface FlavorBrowserProps {
  groups: readonly FlavorGroup[];
  query: string;
  categoryId: number | null;
  onCategory: (id: number | null) => void;
  selected: readonly number[];
  isPromo: boolean;
  onPick: (option: FlavorOption) => void;
}

/** Categorías → sabores (mismas celdas que el POS) o resultados de búsqueda. */
function FlavorBrowser({ groups, query, categoryId, onCategory, selected, isPromo, onPick }: FlavorBrowserProps) {
  if (groups.length === 0) {
    return <EmptyState title="No hay sabores con precio en este tamaño" description="Revisa los precios de las pizzas en Menú." />;
  }
  if (query.trim()) {
    const results = searchFlavors(groups, query);
    const colorOf = new Map(groups.map((g) => [g.category.id, g.category.colorIndex]));
    const categoryOf = new Map(groups.flatMap((g) => g.options.map((o) => [o.itemId, g.category.id] as const)));
    if (results.length === 0) return <p className="py-6 text-center text-sm text-text-muted">No hay sabores que coincidan.</p>;
    return (
      <FlavorTiles
        options={results}
        colorIndex={(id) => colorOf.get(categoryOf.get(id) ?? -1) ?? 0}
        selected={selected}
        isPromo={isPromo}
        onPick={onPick}
      />
    );
  }
  const group = groups.find((g) => g.category.id === categoryId);
  if (!group) {
    const tiles = groups.map((g) => ({ category: g.category, productCount: g.options.length }));
    const chosen = new Map<number, number>();
    for (const g of groups) chosen.set(g.category.id, g.options.filter((o) => selected.includes(o.itemId)).length);
    return <CategoryGrid tiles={tiles} unitsByCategory={chosen} showPhotos={false} onSelect={onCategory} />;
  }
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => onCategory(null)}
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border-2 border-border bg-surface px-4 text-sm font-bold text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {group.category.name}
      </button>
      <FlavorTiles options={group.options} colorIndex={() => group.category.colorIndex} selected={selected} isPromo={isPromo} onPick={onPick} />
    </div>
  );
}

interface FlavorTilesProps {
  options: readonly FlavorOption[];
  colorIndex: (itemId: number) => number;
  selected: readonly number[];
  isPromo: boolean;
  onPick: (option: FlavorOption) => void;
}

function FlavorTiles({ options, colorIndex, selected, isPromo, onPick }: FlavorTilesProps) {
  return (
    <ul aria-label="Sabores" className={TILE_GRID_CLASS}>
      {options.map((option) => {
        const isSelected = selected.includes(option.itemId);
        const priceText = isPromo
          ? option.surchargeCents > 0
            ? `+${formatPEN(option.surchargeCents)}`
            : 'Sin adicional'
          : formatPEN(option.priceCents);
        return (
          <li key={option.itemId}>
            <button
              type="button"
              aria-pressed={isSelected}
              aria-label={`${option.name}, ${priceText}${isSelected ? ', elegido' : ''}`}
              onClick={() => onPick(option)}
              className={cn(
                TILE_BASE_CLASS,
                'min-h-20',
                toneFor(colorIndex(option.itemId)).card,
                isSelected && 'border-forest ring-2 ring-forest',
              )}
            >
              <span className="line-clamp-2 break-words text-base font-bold leading-tight">{option.name}</span>
              <span className="text-sm font-extrabold tabular-nums">{priceText}</span>
              {isSelected && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1.5 -top-1.5 flex size-7 items-center justify-center rounded-full border-2 border-forest bg-accent text-accent-foreground"
                >
                  <Check className="size-4" />
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function PriceSummary({ price }: { price: ReturnType<typeof livePrice> }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="text-sm text-text">
      {price.ok ? (
        <>
          <p className="flex items-baseline justify-between gap-2">
            <span className="font-display font-bold uppercase tracking-wide">Precio</span>
            <span className="text-2xl font-extrabold tabular-nums">{formatPEN(price.result.unitPriceCents)}</span>
          </p>
          {price.explanation.map((line) => (
            <p key={line} className="text-xs text-text-muted">
              {line}
            </p>
          ))}
        </>
      ) : (
        <p className="font-medium text-text-muted">{price.message}</p>
      )}
    </div>
  );
}
