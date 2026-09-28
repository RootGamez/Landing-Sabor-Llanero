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
 * Barra de búsqueda + chips de categoría del catálogo. Vive al principio de la
 * sección (no es sticky): en móvil una barra pegada comía demasiada pantalla y
 * tapaba las primeras tarjetas de cada categoría.
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

  // Chips sobre el panel azul: activo en amarillo (mismo código que los badges
  // y la barra de progreso del hero), inactivos translúcidos.
  const chipClasses = (active: boolean): string =>
    `min-h-11 shrink-0 cursor-pointer rounded-full border-2 px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-brand-blue focus-visible:outline-none ${
      active
        ? "border-brand-yellow bg-brand-yellow text-ink shadow-sm"
        : "border-white/20 bg-white/10 text-white/85 hover:border-brand-yellow/70 hover:bg-white/15 hover:text-white"
    }`;

  return (
    <div className="mb-10 md:mb-12">
      {/* Panel azul de marca: sobre el fondo crema de la carta el blanco
          translúcido de antes se confundía con la página. */}
      <div className="relative overflow-hidden rounded-2xl bg-brand-blue bg-linear-to-br from-brand-blue to-brand-blue-deep p-3 pt-4 shadow-[0_18px_40px_-16px_rgb(0_36_125/0.6)] md:p-4 md:pt-5">
        {/* Capa aparte: `.texture-dots-light` también define background-image y
            pisaría el degradado si fuera clase del propio panel. */}
        <div className="texture-dots-light pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 flex h-1" aria-hidden="true">
          <span className="flex-1 bg-brand-yellow" />
          <span className="flex-1 bg-white" />
          <span className="flex-1 bg-brand-red" />
        </div>
        <label htmlFor={inputId} className="sr-only">
          {ui.searchLabel}
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-brand-blue" />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={ui.searchPlaceholder}
            autoComplete="off"
            className="search-input min-h-12 w-full rounded-full border-2 border-transparent bg-white pr-12 pl-12 text-base text-ink shadow-sm transition-all duration-200 placeholder:text-ink/50 focus:border-brand-yellow focus:ring-4 focus:ring-brand-yellow/40 focus:outline-none"
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
            className="no-scrollbar relative mt-3 flex gap-2 overflow-x-auto pb-1"
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
