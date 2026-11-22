import type { KeyboardEvent, Ref } from 'react';
import { Search, X } from 'lucide-react';
import type { PosCategory } from '../../lib/posCatalog';
import { cn } from '../../lib/utils';
import { toneFor } from './categoryColors';

export const ALL_CATEGORIES = 'all';
export type CategoryFilter = number | typeof ALL_CATEGORIES;

interface ProductToolbarProps {
  categories: readonly PosCategory[];
  category: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  query: string;
  onQueryChange: (query: string) => void;
  searchRef: Ref<HTMLInputElement>;
}

const CHIP_BASE =
  'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border-2 px-4 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function ProductToolbar({
  categories,
  category,
  onCategoryChange,
  query,
  onQueryChange,
  searchRef,
}: ProductToolbarProps) {
  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Escape') return;
    // Esc en el buscador: primero borra el texto; con el campo vacío devuelve el foco a la página.
    if (query) onQueryChange('');
    else event.currentTarget.blur();
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative">
        <label htmlFor="pos-search" className="sr-only">
          Buscar producto
        </label>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          id="pos-search"
          ref={searchRef}
          type="text"
          inputMode="search"
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Buscar producto  ( / )"
          className="h-12 w-full rounded-xl border-2 border-border bg-surface pl-11 pr-12 text-base text-text outline-none transition-colors placeholder:text-text-muted/70 hover:border-forest-line/60 focus:border-primary focus:ring-2 focus:ring-ring/30"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-5" aria-hidden="true" />
            <span className="sr-only">Borrar búsqueda</span>
          </button>
        )}
      </div>

      <div role="group" aria-label="Categorías" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        <button
          type="button"
          aria-pressed={category === ALL_CATEGORIES}
          onClick={() => onCategoryChange(ALL_CATEGORIES)}
          className={cn(
            CHIP_BASE,
            category === ALL_CATEGORIES
              ? 'border-forest bg-primary text-primary-foreground'
              : 'border-border bg-surface text-text hover:border-forest-line',
          )}
        >
          Todos
        </button>
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={category === item.id}
            onClick={() => onCategoryChange(item.id)}
            className={cn(
              CHIP_BASE,
              category === item.id
                ? 'border-forest bg-primary text-primary-foreground'
                : 'border-border bg-surface text-text hover:border-forest-line',
            )}
          >
            <span
              aria-hidden="true"
              className={cn('size-3 rounded-full border border-forest/40', toneFor(item.colorIndex).dot)}
            />
            {item.name}
          </button>
        ))}
      </div>
    </div>
  );
}
