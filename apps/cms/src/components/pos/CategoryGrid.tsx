import { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { CategoryTile } from '../../lib/posNavigation';
import { cn } from '../../lib/utils';
import { toneFor } from './categoryColors';
import { TilePhoto } from './TilePhoto';
import { TILE_SECONDARY_TEXT_CLASS, tileClass, tileGridClass } from './tileStyles';

interface CategoryButtonProps {
  tile: CategoryTile;
  /** Unidades de esta categoría que ya están en el ticket. */
  inCart: number;
  showPhotos: boolean;
  onSelect: (categoryId: number) => void;
}

function InCartBadge({ units }: { units: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute -right-1.5 -top-1.5 flex size-7 items-center justify-center rounded-full border-2 border-forest bg-accent text-xs font-bold text-accent-foreground tabular-nums"
    >
      {units}
    </span>
  );
}

const CategoryButton = memo(function CategoryButton({ tile, inCart, showPhotos, onSelect }: CategoryButtonProps) {
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
      className={cn(tileClass(showPhotos), !showPhotos && 'justify-center gap-1', toneFor(category.colorIndex).card)}
    >
      {showPhotos && <TilePhoto imageKey={category.coverImageKey} />}
      <span className={cn('flex min-w-0 flex-col gap-0.5', showPhotos ? 'flex-1' : 'pr-8')}>
        <span className="line-clamp-2 break-words font-display text-xl font-extrabold leading-tight">{category.name}</span>
        <span className={cn('text-base font-medium', TILE_SECONDARY_TEXT_CLASS)}>{countLabel}</span>
      </span>
      <ChevronRight
        className={cn('size-6 shrink-0 text-text', !showPhotos && 'absolute bottom-3 right-3')}
        aria-hidden="true"
      />
      {inCart > 0 && <InCartBadge units={inCart} />}
    </button>
  );
});

interface CategoryGridProps {
  tiles: readonly CategoryTile[];
  unitsByCategory: ReadonlyMap<number, number>;
  showPhotos: boolean;
  onSelect: (categoryId: number) => void;
}

/** Vista inicial del POS: una celda grande por categoría (con la foto de uno de sus productos si hay "Mostrar fotos"). */
export function CategoryGrid({ tiles, unitsByCategory, showPhotos, onSelect }: CategoryGridProps) {
  return (
    <ul aria-label="Categorías" className={tileGridClass(showPhotos)}>
      {tiles.map((tile) => (
        <li key={tile.category.id}>
          <CategoryButton
            tile={tile}
            inCart={unitsByCategory.get(tile.category.id) ?? 0}
            showPhotos={showPhotos}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}
