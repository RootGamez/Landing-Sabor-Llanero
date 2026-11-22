import { memo } from 'react';
import { formatPEN } from '@sabor/shared';
import { displayPrice, type PosProduct } from '../../lib/posCatalog';
import { cn } from '../../lib/utils';
import { EmptyState } from '../ui/EmptyState';
import { toneFor } from './categoryColors';

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
      className={cn(
        'relative flex h-full min-h-24 w-full flex-col justify-between gap-2 rounded-xl border-2 p-3 text-left text-text outline-none transition-transform select-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100',
        'disabled:cursor-not-allowed disabled:opacity-50',
        toneFor(product.colorIndex).card,
      )}
    >
      <span className="flex flex-col gap-0.5">
        {showCategory && (
          <span className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
            {product.categoryName}
          </span>
        )}
        <span className="line-clamp-2 text-base font-bold leading-tight">{product.name}</span>
      </span>
      <span className="text-sm font-bold tabular-nums">
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

interface ProductGridProps {
  products: readonly PosProduct[];
  unitsByProduct: ReadonlyMap<number, number>;
  showCategory: boolean;
  isFiltering: boolean;
  onSelect: (product: PosProduct) => void;
}

export function ProductGrid({ products, unitsByProduct, showCategory, isFiltering, onSelect }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <EmptyState
        title={isFiltering ? 'Ningún producto coincide' : 'No hay productos en esta categoría'}
        description={isFiltering ? 'Revisa el texto o borra la búsqueda.' : 'Prueba con otra categoría.'}
      />
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-2.5 pb-2 sm:grid-cols-3 xl:grid-cols-4">
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
  );
}
