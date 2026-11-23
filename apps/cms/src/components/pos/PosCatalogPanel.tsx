import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import type { AsyncState } from '../../hooks/useAsync';
import { useShowPhotos } from '../../hooks/useShowPhotos';
import { POS_SECTION_ITEM_LIMIT, priceLookup, type PosCatalog, type PosOption, type PosProduct } from '../../lib/posCatalog';
import { resolveGridView, unitsByCategory, type ActiveCategory } from '../../lib/posNavigation';
import { useCart, useCartApi } from '../../store/posCartContext';
import { usePosCatalogStore } from '../../store/posCatalogStore';
import { toastError } from '../../store/toastStore';
import { FlavorPicker, type FlavorRequest } from './FlavorPicker';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { CategoryGrid } from './CategoryGrid';
import { ProductGrid } from './ProductGrid';
import { ProductToolbar } from './ProductToolbar';
import { SizePicker } from './SizePicker';
import { tileGridClass } from './tileStyles';

type CatalogState = AsyncState<PosCatalog> & { refetch: () => void };

interface PosCatalogPanelProps {
  state: CatalogState;
  searchRef: Ref<HTMLInputElement>;
  /**
   * Alinear el ticket con los precios vigentes al cargar (mostrador). La cuenta de una
   * mesa lo desactiva: sus precios son el snapshot que guardó el servidor.
   */
  repriceOnLoad?: boolean;
}

function GridSkeleton({ showPhotos }: { showPhotos: boolean }) {
  return (
    <div className={tileGridClass(showPhotos)} aria-busy="true" aria-label="Cargando productos">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className={showPhotos ? 'h-20 w-full' : 'h-28 w-full'} />
      ))}
    </div>
  );
}

/** Un carrito restaurado tras un refresh puede traer precios viejos: se alinea con el catálogo vigente. */
function useRepriceCartOnLoad(catalog: PosCatalog | undefined, enabled: boolean) {
  const cart = useCartApi();
  useEffect(() => {
    if (!catalog || !enabled) return;
    const removed = cart.getState().reprice(priceLookup(catalog));
    if (removed.length > 0) {
      toastError(`Se quitaron ${removed.length} producto(s) del ticket que ya no están disponibles.`);
    }
  }, [catalog, enabled, cart]);
}

/** Deja el catálogo cargado a mano del ticket (sabores de una línea) sin volver a pedirlo a la red. */
function usePublishCatalog(state: CatalogState) {
  const publish = usePosCatalogStore((s) => s.publish);
  const { data, error, refetch } = state;
  useEffect(() => {
    publish({ catalog: data ?? null, error: error ?? null, retry: refetch });
  }, [data, error, refetch, publish]);
}

function CatalogBody({
  catalog,
  category,
  query,
  showPhotos,
  onCategoryChange,
}: {
  catalog: PosCatalog;
  category: ActiveCategory;
  query: string;
  showPhotos: boolean;
  onCategoryChange: (category: ActiveCategory) => void;
}) {
  const lines = useCart((s) => s.lines);
  const add = useCart((s) => s.add);
  const [sizeProduct, setSizeProduct] = useState<PosProduct | null>(null);
  const [promoRequest, setPromoRequest] = useState<FlavorRequest | null>(null);

  const unitsByProduct = useMemo(() => {
    const units = new Map<number, number>();
    for (const line of lines) units.set(line.itemId, (units.get(line.itemId) ?? 0) + line.quantity);
    return units;
  }, [lines]);
  const categoryUnits = useMemo(() => unitsByCategory(catalog, unitsByProduct), [catalog, unitsByProduct]);
  const view = useMemo(() => resolveGridView(catalog, category, query), [catalog, category, query]);

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
    // Promo con pizzas a elegir: primero los sabores (precio en vivo con adicionales), luego al ticket.
    if (product.promo && only) setPromoRequest({ product, sizeId: null, initial: null });
    else if (product.options.length === 1 && only) addOption(product, only);
    else if (product.options.length > 1) setSizeProduct(product);
  }

  return (
    <>
      {catalog.truncatedCategories.length > 0 && (
        <p role="status" className="mb-2 rounded-xl border-2 border-lime-strong bg-lime-soft px-3 py-2 text-xs text-text">
          Por ahora solo se muestran los primeros {POS_SECTION_ITEM_LIMIT} productos de: {catalog.truncatedCategories.join(', ')}.
        </p>
      )}
      {view.kind === 'categories' ? (
        <CategoryGrid
          tiles={view.categories}
          unitsByCategory={categoryUnits}
          showPhotos={showPhotos}
          onSelect={onCategoryChange}
        />
      ) : (
        <ProductGrid
          products={view.products}
          unitsByProduct={unitsByProduct}
          showCategory={view.kind === 'search'}
          isFiltering={view.kind === 'search'}
          showPhotos={showPhotos}
          onSelect={handleSelect}
          {...(view.kind === 'products'
            ? { back: { categoryName: view.category.name, onBack: () => onCategoryChange(null) } }
            : {})}
        />
      )}
      <SizePicker
        product={sizeProduct}
        onClose={() => setSizeProduct(null)}
        onPick={(product, option) => {
          addOption(product, option);
          setSizeProduct(null);
        }}
      />
      <FlavorPicker
        request={promoRequest}
        confirmLabel="Agregar al ticket"
        onClose={() => setPromoRequest(null)}
        onConfirm={(choice) => {
          const product = promoRequest?.product;
          const [only] = product?.options ?? [];
          if (product && only) add({ itemId: product.id, sizeId: only.sizeId, name: product.name, sizeLabel: only.label, ...choice });
          setPromoRequest(null);
        }}
      />
    </>
  );
}

/** Buscador + cuadrícula (categorías -> productos de la categoría) de productos con estados de carga, error y vacío. */
export function PosCatalogPanel({ state, searchRef, repriceOnLoad = true }: PosCatalogPanelProps) {
  const [category, setCategory] = useState<ActiveCategory>(null);
  const [query, setQuery] = useState('');
  const [showPhotos, setShowPhotos] = useShowPhotos();
  const scrollRef = useRef<HTMLDivElement>(null);
  useRepriceCartOnLoad(state.data, repriceOnLoad);
  usePublishCatalog(state);

  function changeCategory(next: ActiveCategory) {
    setCategory(next);
    scrollRef.current?.scrollTo({ top: 0 });
  }

  const catalog = state.data;
  let body;
  if (state.error && !catalog) body = <ErrorState message={state.error} onRetry={state.refetch} />;
  else if (!catalog) body = <GridSkeleton showPhotos={showPhotos} />;
  else if (catalog.products.length === 0) {
    body = (
      <EmptyState
        title="No hay productos para mostrador"
        description="Activa productos con canal “Mostrador” o “Ambos” en Tienda online > Menú."
      />
    );
  } else {
    body = (
      <CatalogBody
        catalog={catalog}
        category={category}
        query={query}
        showPhotos={showPhotos}
        onCategoryChange={changeCategory}
      />
    );
  }

  return (
    <section aria-label="Productos" className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <ProductToolbar
        query={query}
        onQueryChange={setQuery}
        searchRef={searchRef}
        showPhotos={showPhotos}
        onShowPhotosChange={setShowPhotos}
      />
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {body}
      </div>
    </section>
  );
}
