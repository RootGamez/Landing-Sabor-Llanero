import { memo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { formatPEN } from '@sabor/shared';
import { displayPrice, type PosProduct } from '../../lib/posCatalog';
import { cn } from '../../lib/utils';
import { EmptyState } from '../ui/EmptyState';
import { toneFor } from './categoryColors';
import { TILE_BASE_CLASS, TILE_GRID_CLASS } from './tileStyles';

interface ProductButtonProps {
  product: PosProduct;
  /** Unidades de este producto (todos los tamaños) que ya están en el ticket. */
  inCart: number;
  showCategory: boolean;
  onSelect: (product: PosProduct) => void;
}

const ProductButton = memo(function ProductButton({ product, inCart, showCategory, onSelect }: ProductButtonProps) {
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
      className={cn(TILE_BASE_CLASS, toneFor(product.colorIndex).card)}
    >
      <span className="flex flex-col gap-0.5">
        {showCategory && (
          <span className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
            {product.categoryName}
          </span>
        )}
        <span className="line-clamp-2 break-words text-base font-bold leading-tight">{product.name}</span>
      </span>
      <span className="text-lg font-extrabold tabular-nums">
        {price ? (
          <>
            {price.isFrom && <span className="font-medium text-text-muted">desde </span>}
            {formatPEN(price.cents)}
          </>
        ) : (
          <span className="font-medium text-text-muted">Sin precio</span>
        )}
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
  onBack: () => void;
}

/** Primera celda de la vista de categoría: mismo tamaño que los productos. */
function BackTile({ categoryName, onBack }: BackTileProps) {
  return (
    <button
      type="button"
      aria-label={`Volver a las categorías. Estás en ${categoryName}`}
      onClick={(event) => {
        if (event.detail > 0) event.currentTarget.blur();
        onBack();
      }}
      className={cn(TILE_BASE_CLASS, 'items-center justify-center gap-1 border-forest bg-surface text-center')}
    >
      <ArrowLeft className="size-9" aria-hidden="true" />
      <span className="text-base font-extrabold">Volver</span>
      <span className="line-clamp-1 max-w-full break-words text-xs font-medium text-text-muted">{categoryName}</span>
    </button>
  );
}

interface ProductGridProps {
  products: readonly PosProduct[];
  unitsByProduct: ReadonlyMap<number, number>;
  showCategory: boolean;
  isFiltering: boolean;
  onSelect: (product: PosProduct) => void;
  /** Si viene, se agrega la celda "Volver" al inicio de la grilla (vista de categoría). */
  back?: { categoryName: string; onBack: () => void };
}

export function ProductGrid({ products, unitsByProduct, showCategory, isFiltering, onSelect, back }: ProductGridProps) {
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
      <ul className={TILE_GRID_CLASS}>
        {back && (
          <li>
            <BackTile categoryName={back.categoryName} onBack={back.onBack} />
          </li>
        )}
        {products.map((product) => (
          <li key={product.id}>
            <ProductButton
              product={product}
              inCart={unitsByProduct.get(product.id) ?? 0}
              showCategory={showCategory}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
      {emptyState}
    </>
  );
}
