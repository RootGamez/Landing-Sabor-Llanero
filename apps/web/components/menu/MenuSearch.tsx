"use client";

import { useId } from "react";
import { displayName, type Category, type Lang } from "@sabor/shared";
import { CloseIcon, SearchIcon } from "@/components/ui/icons";
import { CATALOG_UI } from "@/lib/catalogUi";

/** `null` = sin filtro de categoría (chip "Todo"). */
export type CategoryFilter = number | null;

interface MenuSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  categories: Category[];
  activeCategoryId: CategoryFilter;
  onCategoryChange: (id: CategoryFilter) => void;
  /** Total de ítems visibles; solo se anuncia cuando hay filtro activo. */
  resultCount: number;
  /** True si hay texto escrito o una categoría seleccionada. */
  isFiltering: boolean;
  lang: Lang;
}

/**
 * Barra de búsqueda + chips de categoría del catálogo. Se pega bajo el navbar
 * (`sticky`) para que en una carta larga el usuario nunca tenga que volver
 * arriba a filtrar.
 *
 * El filtrado es instantáneo por tecla (sin debounce): son decenas de ítems ya
 * en memoria, no una llamada de red. El contador vive en un `aria-live` para
 * que un lector de pantalla anuncie cuántos resultados quedaron.
 */
export default function MenuSearch({
  query,
  onQueryChange,
  categories,
  activeCategoryId,
  onCategoryChange,
  resultCount,
  isFiltering,
  lang,
}: MenuSearchProps) {
  const ui = CATALOG_UI[lang];
  const inputId = useId();
  const resultLabel = resultCount === 1 ? ui.resultOne : ui.resultMany;

  const chipClasses = (active: boolean): string =>
    `min-h-11 shrink-0 cursor-pointer rounded-full border-2 px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
      active
        ? "border-brand-blue bg-brand-blue text-white shadow-sm"
        : "border-ink/10 bg-white text-ink/70 hover:border-brand-blue/50 hover:text-brand-blue"
    }`;

  return (
    <div className="sticky top-[4.25rem] z-30 -mx-4 mb-10 px-4 py-3 md:top-[4.75rem] md:mb-12">
      {/* Panel translúcido: deja ver las manchas de pintura al hacer scroll */}
      <div className="rounded-2xl border border-ink/5 bg-cream/85 p-3 shadow-card backdrop-blur-md md:p-4">
        <label htmlFor={inputId} className="sr-only">
          {ui.searchLabel}
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-ink/35" />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={ui.searchPlaceholder}
            autoComplete="off"
            className="search-input min-h-12 w-full rounded-full border-2 border-ink/10 bg-white pr-12 pl-12 text-base text-ink transition-colors duration-200 placeholder:text-ink/40 focus:border-brand-blue focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label={ui.searchClear}
              className="absolute top-1/2 right-2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-ink/40 transition-colors duration-200 hover:bg-ink/5 hover:text-brand-red"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {categories.length > 0 && (
          <div
            role="group"
            aria-label={ui.categoryFilter}
            className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1"
          >
            <button
              type="button"
              aria-pressed={activeCategoryId === null}
              onClick={() => onCategoryChange(null)}
              className={chipClasses(activeCategoryId === null)}
            >
              {ui.allCategories}
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={activeCategoryId === category.id}
                onClick={() => onCategoryChange(category.id)}
                className={chipClasses(activeCategoryId === category.id)}
              >
                {displayName(category, lang)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contador: siempre en el DOM para que la región live sea estable.
          role="status" implica aria-live=polite + aria-atomic, de modo que el
          lector anuncia el string completo ("12 resultados") y no fragmentos. */}
      <p role="status" className="mt-2 text-center text-sm font-medium text-ink/70">
        {isFiltering ? `${resultCount} ${resultLabel}` : ""}
      </p>
    </div>
  );
}
