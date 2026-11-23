import { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { CategoryTile } from '../../lib/posNavigation';
import { cn } from '../../lib/utils';
import { toneFor } from './categoryColors';
import { TILE_BASE_CLASS, TILE_GRID_CLASS } from './tileStyles';

interface CategoryButtonProps {
  tile: CategoryTile;
  /** Unidades de esta categoría que ya están en el ticket. */
  inCart: number;
  onSelect: (categoryId: number) => void;
}

const CategoryButton = memo(function CategoryButton({ tile, inCart, onSelect }: CategoryButtonProps) {
  const { category, productCount } = tile;
  const countLabel = `${productCount} ${productCount === 1 ? 'producto' : 'productos'}`;
  const label = `${category.name}, ${countLabel}${inCart > 0 ? `, ${inCart} en el ticket` : ''}`;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        // Con puntero/toque se suelta el foco para que `Enter` siga cobrando; con teclado (detail 0) se conserva.
        if (event.detail > 0) event.currentTarget.blur();
        onSelect(category.id);
      }}
      className={cn(TILE_BASE_CLASS, 'justify-center gap-1', toneFor(category.colorIndex).card)}
    >
      <span className="line-clamp-2 break-words font-display text-lg font-extrabold leading-tight">{category.name}</span>
      <span className="flex items-center justify-between gap-2 text-sm font-medium text-text-muted">
        {countLabel}
        <ChevronRight className="size-5 shrink-0 text-text" aria-hidden="true" />
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

interface CategoryGridProps {
  tiles: readonly CategoryTile[];
  unitsByCategory: ReadonlyMap<number, number>;
  onSelect: (categoryId: number) => void;
}

/** Vista inicial del POS: una celda grande por categoría. */
export function CategoryGrid({ tiles, unitsByCategory, onSelect }: CategoryGridProps) {
  return (
    <ul aria-label="Categorías" className={TILE_GRID_CLASS}>
      {tiles.map((tile) => (
        <li key={tile.category.id}>
          <CategoryButton tile={tile} inCart={unitsByCategory.get(tile.category.id) ?? 0} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}
