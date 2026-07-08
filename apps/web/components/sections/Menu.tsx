"use client";

import { useEffect, useRef, useState } from "react";
import { FlameIcon, StarIcon } from "@/components/ui/icons";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { CATALOG_UI } from "@/lib/catalogUi";
import { LangProvider, useLang } from "@/lib/lang";
import {
  fetchCollections,
  fetchMenuSections,
  fetchSizes,
  fetchWhatsappConfig,
  findCollection,
} from "@/lib/menuData";
import { useAsync } from "@/lib/useAsync";
import { FALLBACK_WHATSAPP_CONFIG } from "@/lib/whatsapp";
import CategoryBlock from "@/components/menu/CategoryBlock";
import CollectionRail from "@/components/menu/CollectionRail";
import ErrorRetry from "@/components/menu/ErrorRetry";
import LangToggle from "@/components/menu/LangToggle";
import { CollectionsSkeleton, SectionsSkeleton } from "@/components/menu/MenuSkeletons";
import PromosBlock from "@/components/menu/PromosBlock";

/**
 * Sección "Nuestra Carta", montada en el anchor #menu reservado en
 * app/page.tsx (BLUEPRINT fase 5). Todo el catálogo se hidrata client-side
 * contra apps/api (el sitio es export estático, sin SSR) y el fetch recién
 * arranca cuando la sección se acerca al viewport, para no competir con la
 * carga inicial de la landing (Core Web Vitals).
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
    <section
      id="menu"
      className="texture-dots relative overflow-hidden bg-linear-to-b from-cream-deep to-cream py-24 md:py-32"
    >
      <div ref={gateRef} className="mx-auto max-w-6xl px-4 md:px-6">
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
          <div className="space-y-14 md:space-y-20">
            {/* Carrusel "Destacados del día" (+ los otros 2 rails posibles, ver CollectionsSkeleton) */}
            {collections.loading && <CollectionsSkeleton label={ui.loading} />}
            {dailyFeatured && (
              <Reveal>
                <CollectionRail
                  collection={dailyFeatured}
                  sizes={sizes}
                  lang={lang}
                  whatsapp={whatsapp}
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
                  icon={<FlameIcon className="h-5 w-5" />}
                />
              </Reveal>
            )}

            {/* Bloque "Promos especiales" con tratamiento diferenciado */}
            {promos && (
              <Reveal>
                <PromosBlock collection={promos} sizes={sizes} lang={lang} whatsapp={whatsapp} />
              </Reveal>
            )}

            {/* Catálogo por categorías */}
            {sections.loading && <SectionsSkeleton label={ui.loading} />}
            {sections.error && !sections.loading && (
              <ErrorRetry lang={lang} onRetry={sections.retry} />
            )}
            {sections.data?.map((section) => (
              <Reveal key={section.category.id}>
                <CategoryBlock section={section} sizes={sizes} lang={lang} whatsapp={whatsapp} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function Menu() {
  return (
    <LangProvider>
      <MenuContent />
    </LangProvider>
  );
}
