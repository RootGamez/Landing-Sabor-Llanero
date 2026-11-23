import { memo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { formatPEN } from '@sabor/shared';
import { displayPrice, type PosProduct } from '../../lib/posCatalog';
import { cn } from '../../lib/utils';
import { EmptyState } from '../ui/EmptyState';
import { toneFor } from './categoryColors';
import { TilePhoto } from './TilePhoto';
import { TILE_SECONDARY_TEXT_CLASS, tileClass, tileGridClass } from './tileStyles';

interface ProductButtonProps {
  product: PosProduct;
  /** Unidades de este producto (todos los tamaños) que ya están en el ticket. */
  inCart: number;
  showCategory: boolean;
  showPhotos: boolean;
  onSelect: (product: PosProduct) => void;
}

const ProductButton = memo(function ProductButton({
  product,
  inCart,
  showCategory,
  showPhotos,
  onSelect,
}: ProductButtonProps) {
  const price = displayPrice(product);
  const unavailable = price === null;
  const label = [
    product.name,
    price ? `${price.isFrom ? 'desde ' : ''}${formatPEN(price.cents)}` : 'sin precio',
    inCart > 0 ? `${inCart} en el ticket` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <button
      type="button"
      disabled={unavailable}
      onClick={(event) => {
        // Con puntero/toque se suelta el foco para que `Enter` siga cobrando; con teclado (detail 0) se conserva.
        if (event.detail > 0) event.currentTarget.blur();
        onSelect(product);
      }}
      aria-label={label}
      className={cn(tileClass(showPhotos), toneFor(product.colorIndex).card)}
    >
      {showPhotos && <TilePhoto imageKey={product.coverImageKey} />}
      <span className={cn('flex min-w-0 flex-col', showPhotos ? 'flex-1 gap-1' : 'h-full justify-between gap-2')}>
        <span className="flex flex-col gap-0.5">
          {showCategory && (
            <span className={cn('text-xs font-bold uppercase tracking-wide', TILE_SECONDARY_TEXT_CLASS)}>
              {product.categoryName}
            </span>
          )}
          <span className="line-clamp-2 break-words text-lg font-bold leading-tight">{product.name}</span>
        </span>
        <span className="text-xl font-extrabold tabular-nums">
          {price ? (
            <>
              {price.isFrom && <span className={cn('text-base font-medium', TILE_SECONDARY_TEXT_CLASS)}>desde </span>}
              {formatPEN(price.cents)}
            </>
          ) : (
            <span className={cn('font-medium', TILE_SECONDARY_TEXT_CLASS)}>Sin precio</span>
          )}
        </span>
      </span>
      {inCart > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-1.5 -top-1.5 flex size-7 items-center justify-center rounded-full border-2 border-forest bg-accent text-xs font-bold text-accent-foreground tabular-nums"
        >
          {inCart}
        </span>
      )}
    </button>
  );
});

interface BackTileProps {
  categoryName: string;
  showPhotos: boolean;
  onBack: () => void;
}

/** Primera celda de la vista de categoría: mismo tamaño que los productos. */
function BackTile({ categoryName, showPhotos, onBack }: BackTileProps) {
  return (
    <button
      type="button"
      aria-label={`Volver a las categorías. Estás en ${categoryName}`}
      onClick={(event) => {
        if (event.detail > 0) event.currentTarget.blur();
        onBack();
      }}
      className={cn(
        tileClass(showPhotos),
        'border-forest bg-surface',
        showPhotos ? 'justify-start' : 'items-center justify-center gap-1 text-center',
      )}
    >
      <ArrowLeft className={showPhotos ? 'mx-5 size-9 shrink-0' : 'size-9'} aria-hidden="true" />
      <span className={cn('flex min-w-0 flex-col', !showPhotos && 'items-center')}>
        <span className="text-lg font-extrabold">Volver</span>
        <span className={cn('line-clamp-1 max-w-full break-words text-sm font-medium', TILE_SECONDARY_TEXT_CLASS)}>
          {categoryName}
        </span>
      </span>
    </button>
  );
}

interface ProductGridProps {
  products: readonly PosProduct[];
  unitsByProduct: ReadonlyMap<number, number>;
  showCategory: boolean;
  isFiltering: boolean;
  showPhotos: boolean;
  onSelect: (product: PosProduct) => void;
  /** Si viene, se agrega la celda "Volver" al inicio de la grilla (vista de categoría). */
  back?: { categoryName: string; onBack: () => void };
}

export function ProductGrid({
  products,
  unitsByProduct,
  showCategory,
  isFiltering,
  showPhotos,
  onSelect,
  back,
}: ProductGridProps) {
  const emptyState =
    products.length === 0 ? (
      <EmptyState
        title={isFiltering ? 'Ningún producto coincide' : 'No hay productos en esta categoría'}
        description={isFiltering ? 'Revisa el texto o borra la búsqueda.' : 'Toca "Volver" para elegir otra categoría.'}
      />
    ) : null;
  if (emptyState && !back) return emptyState;
  return (
    <>
      <ul className={tileGridClass(showPhotos)}>
        {back && (
          <li>
            <BackTile categoryName={back.categoryName} showPhotos={showPhotos} onBack={back.onBack} />
          </li>
        )}
        {products.map((product) => (
          <li key={product.id}>
            <ProductButton
              product={product}
              inCart={unitsByProduct.get(product.id) ?? 0}
              showCategory={showCategory}
              showPhotos={showPhotos}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
      {emptyState}
    </>
  );
}
