import { useEffect, useMemo, useState, type Ref } from 'react';
import type { AsyncState } from '../../hooks/useAsync';
import { POS_SECTION_ITEM_LIMIT, normalizeText, priceLookup, type PosCatalog, type PosOption, type PosProduct } from '../../lib/posCatalog';
import { usePosCartStore } from '../../store/posCartStore';
import { toastError } from '../../store/toastStore';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { ProductGrid } from './ProductGrid';
import { ALL_CATEGORIES, ProductToolbar, type CategoryFilter } from './ProductToolbar';
import { SizePicker } from './SizePicker';

type CatalogState = AsyncState<PosCatalog> & { refetch: () => void };

interface PosCatalogPanelProps {
  state: CatalogState;
  searchRef: Ref<HTMLInputElement>;
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4" aria-busy="true" aria-label="Cargando productos">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-24 w-full" />
      ))}
    </div>
  );
}

/** Un carrito restaurado tras un refresh puede traer precios viejos: se alinea con el catálogo vigente. */
function useRepriceCartOnLoad(catalog: PosCatalog | undefined) {
  useEffect(() => {
    if (!catalog) return;
    const removed = usePosCartStore.getState().reprice(priceLookup(catalog));
    if (removed.length > 0) {
      toastError(`Se quitaron ${removed.length} producto(s) del ticket que ya no están disponibles.`);
    }
  }, [catalog]);
}

function filterProducts(catalog: PosCatalog, category: CategoryFilter, query: string): PosProduct[] {
  const needle = normalizeText(query);
  if (needle) return catalog.products.filter((product) => product.searchText.includes(needle));
  if (category === ALL_CATEGORIES) return catalog.products;
  return catalog.products.filter((product) => product.categoryId === category);
}

function CatalogBody({
  catalog,
  category,
  query,
}: {
  catalog: PosCatalog;
  category: CategoryFilter;
  query: string;
}) {
  const lines = usePosCartStore((s) => s.lines);
  const add = usePosCartStore((s) => s.add);
  const [sizeProduct, setSizeProduct] = useState<PosProduct | null>(null);

  const unitsByProduct = useMemo(() => {
    const units = new Map<number, number>();
    for (const line of lines) units.set(line.itemId, (units.get(line.itemId) ?? 0) + line.quantity);
    return units;
  }, [lines]);
  const visible = useMemo(() => filterProducts(catalog, category, query), [catalog, category, query]);

  function addOption(product: PosProduct, option: PosOption) {
    add({
      itemId: product.id,
      sizeId: option.sizeId,
      name: product.name,
      sizeLabel: option.label,
      unitPriceCents: option.priceCents,
    });
  }

  function handleSelect(product: PosProduct) {
    const [only] = product.options;
    if (product.options.length === 1 && only) addOption(product, only);
    else if (product.options.length > 1) setSizeProduct(product);
  }

  return (
    <>
      {catalog.truncatedCategories.length > 0 && (
        <p role="status" className="mb-2 rounded-xl border-2 border-lime-strong bg-lime-soft px-3 py-2 text-xs text-text">
          Por ahora solo se muestran los primeros {POS_SECTION_ITEM_LIMIT} productos de: {catalog.truncatedCategories.join(', ')}.
        </p>
      )}
      <ProductGrid
        products={visible}
        unitsByProduct={unitsByProduct}
        showCategory={category === ALL_CATEGORIES || query.trim() !== ''}
        isFiltering={query.trim() !== ''}
        onSelect={handleSelect}
      />
      <SizePicker
        product={sizeProduct}
        onClose={() => setSizeProduct(null)}
        onPick={(product, option) => {
          addOption(product, option);
          setSizeProduct(null);
        }}
      />
    </>
  );
}

/** Buscador + chips de categoría + grilla de productos con estados de carga, error y vacío. */
export function PosCatalogPanel({ state, searchRef }: PosCatalogPanelProps) {
  const [category, setCategory] = useState<CategoryFilter>(ALL_CATEGORIES);
  const [query, setQuery] = useState('');
  useRepriceCartOnLoad(state.data);

  const catalog = state.data;
  let body;
  if (state.error && !catalog) body = <ErrorState message={state.error} onRetry={state.refetch} />;
  else if (!catalog) body = <GridSkeleton />;
  else if (catalog.products.length === 0) {
    body = (
      <EmptyState
        title="No hay productos para mostrador"
        description="Activa productos con canal “Mostrador” o “Ambos” en Tienda online > Menú."
      />
    );
  } else body = <CatalogBody catalog={catalog} category={category} query={query} />;

  return (
    <section aria-label="Productos" className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <ProductToolbar
        categories={catalog?.categories ?? []}
        category={category}
        onCategoryChange={setCategory}
        query={query}
        onQueryChange={setQuery}
        searchRef={searchRef}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{body}</div>
    </section>
  );
}
