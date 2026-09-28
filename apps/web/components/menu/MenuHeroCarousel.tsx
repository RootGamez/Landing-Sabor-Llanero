"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  CATALOG_COPY,
  displayDescription,
  displayName,
  formatPrice,
  type CollectionWithItems,
  type Lang,
  type MenuItemWithPrices,
} from "@sabor/shared";
import { ChevronLeftIcon, ChevronRightIcon, FlameIcon, PizzaSliceIcon, StarIcon } from "@/components/ui/icons";
import LangToggle from "@/components/menu/LangToggle";
import Reveal from "@/components/ui/Reveal";
import { mediaUrl } from "@/lib/api";
import { CATALOG_UI, displayCollectionTitle } from "@/lib/catalogUi";

const AUTOPLAY_MS = 5000;

interface HeroSlide {
  item: MenuItemWithPrices;
  badgeKind: "featured" | "topSeller";
  badgeLabel: string;
}

interface MenuHeroCarouselProps {
  dailyFeatured: CollectionWithItems | null;
  topSellers: CollectionWithItems | null;
  lang: Lang;
  loading: boolean;
  onOpen: (item: MenuItemWithPrices) => void;
}

/** Intercala destacados y más pedidos (1 de cada, alternando) en un único carrusel. */
function buildSlides(
  dailyFeatured: CollectionWithItems | null,
  topSellers: CollectionWithItems | null,
  lang: Lang,
): HeroSlide[] {
  const featured =
    dailyFeatured && dailyFeatured.isActive && dailyFeatured.items.length > 0
      ? dailyFeatured.items.map((item) => ({
          item,
          badgeKind: "featured" as const,
          badgeLabel: displayCollectionTitle(dailyFeatured, lang),
        }))
      : [];
  const topSold =
    topSellers && topSellers.isActive && topSellers.items.length > 0
      ? topSellers.items.map((item) => ({
          item,
          badgeKind: "topSeller" as const,
          badgeLabel: displayCollectionTitle(topSellers, lang),
        }))
      : [];

  const merged: HeroSlide[] = [];
  const max = Math.max(featured.length, topSold.length);
  for (let i = 0; i < max; i++) {
    const a = featured[i];
    const b = topSold[i];
    if (a) merged.push(a);
    if (b) merged.push(b);
  }
  return merged;
}

/**
 * Hero de la ruta /menu: banda oscura a todo el ancho (mismo lenguaje visual
 * que el Hero de la home) que reemplaza el encabezado plano de antes.
 * Fusiona los rails "Destacados del día" y "Los más pedidos" en un único
 * carrusel automático — ya no se repiten más abajo — y aloja acá el
 * selector de idioma grande, en su esquina superior derecha (antes una pill
 * diminuta "ES/EN" bajo el título).
 *
 * El título "Nuestra Carta" (h2) SIEMPRE se renderiza, incluso si
 * `collections` falló o está vacío: la jerarquía SEO de la sección no
 * depende de esos datos, solo el carrusel de productos lo hace (mismo
 * criterio de degradación por bloque que ya usaba CollectionRail).
 */
export default function MenuHeroCarousel({
  dailyFeatured,
  topSellers,
  lang,
  loading,
  onOpen,
}: MenuHeroCarouselProps) {
  const ui = CATALOG_UI[lang];
  const copy = CATALOG_COPY[lang];
  const slides = useMemo(() => buildSlides(dailyFeatured, topSellers, lang), [dailyFeatured, topSellers, lang]);

  const [current, setCurrent] = useState(0);
  const paused = useRef(false);
  const touchStartX = useRef<number | null>(null);
  const activeIndex = slides.length > 0 ? current % slides.length : 0;
  const slide = slides[activeIndex];

  // Autoplay con pausa al hover/touch — mismo patrón que HeroCarousel de la home.
  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      if (!paused.current) setCurrent((c) => c + 1);
    }, AUTOPLAY_MS);
    return () => clearInterval(interval);
  }, [slides.length]);

  const goTo = (index: number): void => {
    if (slides.length === 0) return;
    setCurrent(((index % slides.length) + slides.length) % slides.length);
  };

  const onTouchStart = (e: React.TouchEvent): void => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartX.current = touch.clientX;
  };
  const onTouchEnd = (e: React.TouchEvent): void => {
    if (touchStartX.current === null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const delta = touch.clientX - touchStartX.current;
    if (Math.abs(delta) > 50) goTo(activeIndex + (delta < 0 ? 1 : -1));
    touchStartX.current = null;
  };

  const hasSizes = slide ? slide.item.prices.length > 0 : false;
  const fromPrice = slide && hasSizes ? Math.min(...slide.item.prices.map((p) => p.price)) : null;
  const priceLabel = !slide
    ? ""
    : hasSizes && fromPrice != null
      ? `${copy.from} ${formatPrice(fromPrice)}`
      : slide.item.price != null
        ? formatPrice(slide.item.price)
        : "";

  return (
    <div
      className="texture-dots-light relative w-full overflow-hidden bg-charcoal"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      {/* Resplandores de horno, mismo recurso que el Hero de la home */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-[26rem] w-[26rem] rounded-full bg-brand-yellow/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-32 -bottom-32 h-[26rem] w-[26rem] rounded-full bg-brand-red/15 blur-3xl"
        aria-hidden="true"
      />

      {/* Selector de idioma: esquina superior derecha, grande y explícito. En
          móvil el título va centrado a todo el ancho, así que el bloque de
          texto reserva espacio arriba (pt-24) para no quedar tapado. */}
      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <LangToggle />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 pt-24 pb-10 text-center md:px-6 md:pt-12 md:pb-14">
        <Reveal>
          <span className="inline-block rounded-full bg-brand-yellow/15 px-4 py-1 text-xs font-semibold tracking-[0.2em] text-brand-yellow uppercase">
            {ui.kicker}
          </span>
        </Reveal>
        <Reveal delay={90}>
          <h2 className="mt-4 font-display text-4xl tracking-wide text-white sm:text-5xl md:text-6xl">{ui.title}</h2>
        </Reveal>
        <Reveal delay={160}>
          <div className="mx-auto mt-4 flex h-1.5 w-28 overflow-hidden rounded-full" aria-hidden="true">
            <span className="flex-1 bg-brand-yellow" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-brand-red" />
          </div>
        </Reveal>
        <Reveal delay={220}>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/75 md:text-lg">{ui.subtitle}</p>
        </Reveal>

        {loading && (
          <div
            className="mt-10 flex animate-pulse flex-col items-center gap-8 md:flex-row md:gap-14"
            aria-hidden="true"
          >
            <div className="order-2 w-full space-y-4 text-left md:order-1">
              <div className="h-6 w-36 rounded-full bg-white/10" />
              <div className="h-9 w-3/4 rounded-lg bg-white/10" />
              <div className="h-4 w-full rounded bg-white/10" />
              <div className="h-11 w-44 rounded-full bg-white/10" />
            </div>
            <div className="order-1 aspect-[4/3] w-full max-w-sm shrink-0 rounded-[1.5rem] bg-white/10 md:order-2 md:w-[26rem]" />
          </div>
        )}

        {!loading && slide && (
          <div
            className="relative mt-10 flex touch-pan-y flex-col items-center gap-8 md:flex-row md:gap-14 md:px-14"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              aria-label={ui.prev}
              className="absolute top-1/2 left-1 z-20 hidden h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-sm transition-colors duration-200 hover:bg-white/25 md:flex lg:-left-3"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>

            <div key={activeIndex} className="animate-hero-slide-in order-2 flex-1 text-left md:order-1">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold tracking-wide uppercase ${
                  slide.badgeKind === "featured" ? "bg-brand-yellow text-ink" : "bg-brand-red text-white"
                }`}
              >
                {slide.badgeKind === "featured" ? (
                  <StarIcon className="h-3.5 w-3.5" />
                ) : (
                  <FlameIcon className="h-3.5 w-3.5" />
                )}
                {slide.badgeLabel}
              </span>

              <h3 className="mt-4 font-display text-3xl leading-none tracking-wide text-white sm:text-4xl">
                {displayName(slide.item, lang)}
              </h3>
              {displayDescription(slide.item, lang) && (
                <p className="mt-2.5 max-w-md text-sm leading-relaxed text-white/70 sm:text-base">
                  {displayDescription(slide.item, lang)}
                </p>
              )}
              {priceLabel && (
                <p className="mt-4 font-display text-2xl text-brand-yellow tabular-nums sm:text-3xl">{priceLabel}</p>
              )}

              <button
                type="button"
                onClick={() => onOpen(slide.item)}
                className="btn-shine mt-6 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-brand-red px-7 text-sm font-semibold text-white shadow-glow-red transition-all duration-300 hover:scale-[1.03] hover:bg-brand-red-deep active:scale-95"
              >
                {ui.viewDetails}
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>

            <div
              key={`${activeIndex}-img`}
              className="animate-hero-slide-in order-1 w-full max-w-sm shrink-0 md:order-2 md:w-[26rem]"
            >
              <div className="relative aspect-[4/3]">
                <div
                  className="absolute -inset-2 rounded-[1.75rem] opacity-60"
                  style={{
                    background: "linear-gradient(140deg, #ffce00 0%, #00247d 50%, #cf142b 100%)",
                    filter: "blur(14px)",
                  }}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => onOpen(slide.item)}
                  aria-label={`${ui.viewDetails}: ${displayName(slide.item, lang)}`}
                  className="group relative block h-full w-full cursor-pointer overflow-hidden rounded-[1.5rem] shadow-[0_30px_70px_-18px_rgba(0,0,0,0.85)] ring-1 ring-white/15"
                >
                  {slide.item.coverImageKey ? (
                    <Image
                      src={mediaUrl(slide.item.coverImageKey)}
                      alt=""
                      fill
                      priority={activeIndex === 0}
                      sizes="(max-width: 768px) 90vw, 26rem"
                      className="animate-ken-burns object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center bg-white/5 text-white/30"
                      aria-hidden="true"
                    >
                      <PizzaSliceIcon className="h-14 w-14" />
                    </div>
                  )}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              aria-label={ui.next}
              className="absolute top-1/2 right-1 z-20 hidden h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-sm transition-colors duration-200 hover:bg-white/25 md:flex lg:-right-3"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        )}

        {!loading && slides.length > 1 && (
          <div className="mt-8 flex justify-center gap-2.5">
            {slides.map((s, i) => (
              <button
                key={`${s.badgeKind}-${s.item.id}-${i}`}
                type="button"
                aria-label={`${ui.viewDetails}: ${displayName(s.item, lang)}`}
                aria-current={i === activeIndex}
                onClick={() => goTo(i)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  i === activeIndex ? "w-8 bg-brand-yellow" : "w-2.5 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
