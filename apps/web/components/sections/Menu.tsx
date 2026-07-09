"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Category, MenuItemWithPrices } from "@sabor/shared";
import { FlameIcon, SearchIcon, StarIcon } from "@/components/ui/icons";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { CATALOG_UI } from "@/lib/catalogUi";
import { itemMatchesTokens, toSearchTokens } from "@/lib/catalogSearch";
import { LangProvider, useLang } from "@/lib/lang";
import {
  fetchCollections,
  fetchMenuSections,
  fetchSizes,
  fetchWhatsappConfig,
  findCollection,
  type CatalogSection,
} from "@/lib/menuData";
import { useAsync } from "@/lib/useAsync";
import { FALLBACK_WHATSAPP_CONFIG } from "@/lib/whatsapp";
import CategoryBlock from "@/components/menu/CategoryBlock";
import CollectionRail from "@/components/menu/CollectionRail";
import ErrorRetry from "@/components/menu/ErrorRetry";
import ItemModal from "@/components/menu/ItemModal";
import LangToggle from "@/components/menu/LangToggle";
import MenuSearch, { type CategoryFilter } from "@/components/menu/MenuSearch";
import { CollectionsSkeleton, SectionsSkeleton } from "@/components/menu/MenuSkeletons";
import PaintSplashes from "@/components/menu/PaintSplashes";
import PromosBlock from "@/components/menu/PromosBlock";

/**
 * Aplica texto + categoría sobre el catálogo. Devuelve secciones nuevas (no
 * muta las de la API) y descarta las que quedan sin ítems, para no dejar
 * encabezados de categoría huérfanos colgando bajo un filtro.
 */
function filterSections(
  sections: CatalogSection[],
  tokens: string[],
  categoryId: CategoryFilter,
): CatalogSection[] {
  return sections
    .filter((section) => categoryId === null || section.category.id === categoryId)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => itemMatchesTokens(item, tokens)),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * Sección "Nuestra Carta", montada en la ruta dedicada /menu
 * (app/menu/page.tsx). Todo el catálogo se hidrata client-side
 * contra apps/api (el sitio es export estático, sin SSR) y el fetch recién
 * arranca cuando la sección se acerca al viewport — en /menu el gate
 * dispara de inmediato porque la sección está arriba del todo.
 *
 * Con un filtro activo (texto o categoría) los rails de merchandising se
 * ocultan: mezclar "los más pedidos" con resultados de búsqueda confunde sobre
 * qué se está viendo. Sin filtro, el catálogo se ve tal como antes.
 *
 * Degradación por bloque: si fallan solo las colecciones, los rails
 * simplemente no aparecen; si falla el catálogo por categorías, se ofrece
 * reintentar; nada de esto rompe el resto de la landing.
 */
function MenuContent() {
  const { lang } = useLang();
  const ui = CATALOG_UI[lang];

  // Gate de visibilidad: los fetch arrancan cuando la sección está a ~600px
  // de entrar en pantalla (mismo patrón lazy que PizzaModelViewer).
  const gateRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const el = gateRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setEnabled(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const collections = useAsync(fetchCollections, enabled);
  const sections = useAsync(fetchMenuSections, enabled);
  const sizesState = useAsync(fetchSizes, enabled);
  const whatsappState = useAsync(fetchWhatsappConfig, enabled);

  // Ambos con fallback: el catálogo funciona aunque estos dos fetch fallen
  // (labels de tamaño caen al sizeKey; WhatsApp cae al número de BRAND).
  const sizes = sizesState.data ?? [];
  const whatsapp = whatsappState.data ?? FALLBACK_WHATSAPP_CONFIG;

  const [query, setQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<CategoryFilter>(null);
  const [activeItem, setActiveItem] = useState<MenuItemWithPrices | null>(null);

  const closeModal = useCallback(() => setActiveItem(null), []);
  const clearFilters = useCallback(() => {
    setQuery("");
    setActiveCategoryId(null);
  }, []);

  const tokens = useMemo(() => toSearchTokens(query), [query]);
  const isFiltering = tokens.length > 0 || activeCategoryId !== null;

  const allSections = useMemo(() => sections.data ?? [], [sections.data]);
  const visibleSections = useMemo(
    () => (isFiltering ? filterSections(allSections, tokens, activeCategoryId) : allSections),
    [allSections, tokens, activeCategoryId, isFiltering],
  );
  const resultCount = useMemo(
    () => visibleSections.reduce((total, section) => total + section.items.length, 0),
    [visibleSections],
  );
  const categories: Category[] = useMemo(
    () => allSections.map((section) => section.category),
    [allSections],
  );

  const dailyFeatured = findCollection(collections.data, "daily_featured");
  const topSellers = findCollection(collections.data, "top_sellers");
  const promos = findCollection(collections.data, "promos");

  const everythingFailed = Boolean(collections.error && sections.error);
  const retryAll = (): void => {
    collections.retry();
    sections.retry();
    sizesState.retry();
    whatsappState.retry();
  };

  return (
    <section id="menu" className="texture-dots relative bg-linear-to-b from-cream-deep to-cream py-24 md:py-32">
      {/* Manchas tricolor: recortan dentro de su propio contenedor, para que la
          sección no necesite overflow-hidden (rompería el buscador sticky). */}
      <PaintSplashes />

      <div ref={gateRef} className="relative mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeading kicker={ui.kicker} title={ui.title} subtitle={ui.subtitle} />

        {/* Toggle de idioma del catálogo, pegado al encabezado */}
        <Reveal delay={150}>
          <div className="-mt-8 mb-12 flex justify-center md:-mt-12 md:mb-16">
            <LangToggle />
          </div>
        </Reveal>

        {everythingFailed ? (
          <ErrorRetry lang={lang} onRetry={retryAll} />
        ) : (
          <>
            {/* El buscador aparece recién con el catálogo cargado: filtrar
                sobre un skeleton no tiene sentido. */}
            {allSections.length > 0 && (
              <MenuSearch
                query={query}
                onQueryChange={setQuery}
                categories={categories}
                activeCategoryId={activeCategoryId}
                onCategoryChange={setActiveCategoryId}
                resultCount={resultCount}
                isFiltering={isFiltering}
                lang={lang}
              />
            )}

            <div className="space-y-14 md:space-y-20">
              {!isFiltering && (
                <>
                  {/* Carrusel "Destacados del día" (+ los otros 2 rails posibles) */}
                  {collections.loading && <CollectionsSkeleton label={ui.loading} />}
                  {dailyFeatured && (
                    <Reveal>
                      <CollectionRail
                        collection={dailyFeatured}
                        sizes={sizes}
                        lang={lang}
                        whatsapp={whatsapp}
                        onOpen={setActiveItem}
                        icon={<StarIcon className="h-5 w-5" />}
                      />
                    </Reveal>
                  )}

                  {/* Rail "Los más pedidos", arriba del catálogo por categorías */}
                  {topSellers && (
                    <Reveal>
                      <CollectionRail
                        collection={topSellers}
                        sizes={sizes}
                        lang={lang}
                        whatsapp={whatsapp}
                        onOpen={setActiveItem}
                        icon={<FlameIcon className="h-5 w-5" />}
                      />
                    </Reveal>
                  )}

                  {/* Bloque "Promos especiales" con tratamiento diferenciado */}
                  {promos && (
                    <Reveal>
                      <PromosBlock
                        collection={promos}
                        sizes={sizes}
                        lang={lang}
                        whatsapp={whatsapp}
                        onOpen={setActiveItem}
                      />
                    </Reveal>
                  )}
                </>
              )}

              {/* Catálogo por categorías */}
              {sections.loading && <SectionsSkeleton label={ui.loading} />}
              {sections.error && !sections.loading && (
                <ErrorRetry lang={lang} onRetry={sections.retry} />
              )}

              {isFiltering && resultCount === 0 ? (
                <NoResults
                  title={ui.noResultsTitle}
                  hint={ui.noResultsHint}
                  action={ui.clearFilters}
                  onClear={clearFilters}
                />
              ) : (
                visibleSections.map((section) => (
                  <Reveal key={section.category.id}>
                    <CategoryBlock
                      section={section}
                      sizes={sizes}
                      lang={lang}
                      whatsapp={whatsapp}
                      onOpen={setActiveItem}
                    />
                  </Reveal>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {activeItem && (
        <ItemModal
          item={activeItem}
          sizes={sizes}
          lang={lang}
          whatsapp={whatsapp}
          onClose={closeModal}
        />
      )}
    </section>
  );
}

interface NoResultsProps {
  title: string;
  hint: string;
  action: string;
  onClear: () => void;
}

/** Estado vacío del buscador: nunca deja al usuario en una pantalla en blanco. */
function NoResults({ title, hint, action, onClear }: NoResultsProps) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-ink/10 bg-white/60 px-6 py-16 text-center backdrop-blur-sm">
      <span
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-blue/8 text-brand-blue"
        aria-hidden="true"
      >
        <SearchIcon className="h-7 w-7" />
      </span>
      <h3 className="font-display text-2xl tracking-wide text-ink md:text-3xl">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink/60">{hint}</p>
      <button
        type="button"
        onClick={onClear}
        className="btn-shine mt-6 inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-brand-red px-6 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:scale-[1.03] hover:bg-brand-red-deep active:scale-95"
      >
        {action}
      </button>
    </div>
  );
}

export default function Menu() {
  return (
    <LangProvider>
      <MenuContent />
    </LangProvider>
  );
}
