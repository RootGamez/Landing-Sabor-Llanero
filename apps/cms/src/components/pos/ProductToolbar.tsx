import type { KeyboardEvent, Ref } from 'react';
import { Search, X } from 'lucide-react';

interface ProductToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  searchRef: Ref<HTMLInputElement>;
}

export function ProductToolbar({ query, onQueryChange, searchRef }: ProductToolbarProps) {
  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Escape') return;
    // Esc en el buscador: primero borra el texto; con el campo vacío devuelve el foco a la página.
    if (query) onQueryChange('');
    else event.currentTarget.blur();
  }

  return (
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
  );
}
