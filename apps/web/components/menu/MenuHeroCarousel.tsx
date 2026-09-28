"use client";

import { useMemo, useRef, useState } from "react";
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
import {
  ArrowDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FlameIcon,
  PizzaSliceIcon,
  StarIcon,
} from "@/components/ui/icons";
import HeroBackdrop from "@/components/menu/HeroBackdrop";
import LangToggle from "@/components/menu/LangToggle";
import { mediaUrl } from "@/lib/api";
import { CATALOG_UI, displayCollectionTitle } from "@/lib/catalogUi";

const AUTOPLAY_MS = 5000;

/** Alto del navbar fijo (ver app/menu/page.tsx `pt-[4.25rem] md:pt-[4.75rem]`). */
const HERO_HEIGHT = "h-[calc(100dvh-4.25rem)] md:h-[calc(100dvh-4.75rem)]";

/** Mismo `sizes` en la capa desenfocada y en la nítida: ambas piden la misma URL (una sola descarga). */
const IMAGE_SIZES = "(max-width: 768px) 100vw, 36rem";

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

function priceLabelFor(item: MenuItemWithPrices, lang: Lang): string {
  if (item.prices.length > 0) {
    const fromPrice = Math.min(...item.prices.map((p) => p.price));
    return `${CATALOG_COPY[lang].from} ${formatPrice(fromPrice)}`;
  }
  return item.price != null ? formatPrice(item.price) : "";
}

/**
 * Hero de la ruta /menu, estilo banner de tienda: ocupa exactamente el alto
 * de pantalla disponible (100dvh menos el navbar) y NUNCA hace scroll.
 *
 * Cómo se garantiza que todo quepa: el marco de la foto es el único elemento
 * flexible (`flex-1 min-h-0`) — título, info y controles tienen alto propio y
 * la foto absorbe lo que sobre, sea un iPhone SE o un monitor 4K.
 *
 * Cómo se adapta cualquier foto: las fotos del catálogo son de proporciones
 * muy distintas (retratos 3:4, flyers de promo con texto). En vez de recortar
 * con `object-cover`, se muestra la imagen completa (`object-contain`) sobre
 * una copia desenfocada de sí misma que rellena el marco — el patrón que usan
 * las tiendas para banners con imágenes heterogéneas. Ningún flyer pierde su
 * texto y ningún marco queda con franjas vacías.
 *
 * Autoplay: lo maneja la barra de progreso del slide activo (al terminar su
 * animación CSS avanza al siguiente), así la pausa por hover/foco/toque es
 * exacta y con `prefers-reduced-motion` el carrusel no avanza solo.
 *
 * El título "Nuestra Carta" (h2) SIEMPRE se renderiza, aunque `collections`
 * falle: la jerarquía SEO de la sección no depende de esos datos.
 */
export default function MenuHeroCarousel({
  dailyFeatured,
  topSellers,
  lang,
  loading,
  onOpen,
}: MenuHeroCarouselProps) {
  const ui = CATALOG_UI[lang];
  const slides = useMemo(() => buildSlides(dailyFeatured, topSellers, lang), [dailyFeatured, topSellers, lang]);

  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const activeIndex = slides.length > 0 ? current % slides.length : 0;
  const slide = slides[activeIndex];

  const goTo = (index: number): void => {
    if (slides.length === 0) return;
    setCurrent(((index % slides.length) + slides.length) % slides.length);
  };

  const onTouchStart = (e: React.TouchEvent): void => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartX.current = touch.clientX;
    setIsPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent): void => {
    setIsPaused(false);
    if (touchStartX.current === null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const delta = touch.clientX - touchStartX.current;
    if (Math.abs(delta) > 50) goTo(activeIndex + (delta < 0 ? 1 : -1));
    touchStartX.current = null;
  };

  const name = slide ? displayName(slide.item, lang) : "";
  const description = slide ? displayDescription(slide.item, lang) : "";
  const priceLabel = slide ? priceLabelFor(slide.item, lang) : "";

  return (
    <div
      className={`relative w-full overflow-hidden bg-brand-blue-ink ${HERO_HEIGHT}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <HeroBackdrop />

      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col px-4 md:px-6">
        {/* Encabezado: en móvil el selector va arriba a la derecha y el título
            debajo; desde md, título a la izquierda y selector a la derecha. */}
        <header className="flex shrink-0 flex-col-reverse gap-2 pt-3 sm:pt-4 md:flex-row md:items-center md:justify-between md:gap-6 md:pt-6">
          <div className="text-center md:text-left">
            <span className="hidden rounded-full bg-brand-yellow/15 px-4 py-1 text-xs font-semibold tracking-[0.2em] text-brand-yellow uppercase sm:inline-block">
              {ui.kicker}
            </span>
            <h2 className="font-display text-3xl leading-none tracking-wide text-white sm:mt-2 sm:text-4xl lg:text-5xl">
              {ui.title}
            </h2>
            <p className="mt-2 hidden max-w-md text-sm text-white/70 lg:block">{ui.subtitle}</p>
          </div>
          <div className="self-end md:self-auto">
            <LangToggle />
          </div>
        </header>

        {/* Escenario: la foto es el único elemento flexible */}
        <div
          className="flex min-h-0 flex-1 touch-pan-y flex-col gap-3 py-3 sm:gap-4 sm:py-4 md:flex-row md:items-center md:gap-10 md:py-6 lg:gap-14"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {loading && <StageSkeleton />}

          {!loading && !slide && (
            <div className="flex min-h-0 flex-1 items-center justify-center text-white/15" aria-hidden="true">
              <PizzaSliceIcon className="h-24 w-24" />
            </div>
          )}

          {!loading && slide && (
            <>
              {/* Marco de la foto */}
              <div className="relative min-h-0 w-full flex-1 md:order-2 md:h-full md:w-auto md:max-w-[55%] md:flex-none md:aspect-[4/5]">
                <div
                  className="absolute -inset-1.5 rounded-[1.9rem] opacity-50"
                  style={{
                    background: "linear-gradient(140deg, #ffce00 0%, #00247d 50%, #cf142b 100%)",
                    filter: "blur(14px)",
                  }}
                  aria-hidden="true"
                />
                <button
                  key={activeIndex}
                  type="button"
                  onClick={() => onOpen(slide.item)}
                  aria-label={`${ui.viewDetails}: ${name}`}
                  className="animate-hero-slide-in group relative block h-full w-full cursor-pointer overflow-hidden rounded-[1.75rem] bg-black shadow-[0_30px_70px_-18px_rgba(0,0,0,0.85)] ring-1 ring-white/15"
                >
                  {slide.item.coverImageKey ? (
                    <>
                      {/* Relleno: la misma foto, ampliada y desenfocada */}
                      <Image
                        src={mediaUrl(slide.item.coverImageKey)}
                        alt=""
                        fill
                        sizes={IMAGE_SIZES}
                        priority={activeIndex === 0}
                        className="scale-125 object-cover opacity-60 blur-2xl"
                        aria-hidden="true"
                      />
                      <div className="absolute inset-0 bg-charcoal/30" aria-hidden="true" />
                      {/* Foto completa, sin recortes */}
                      <Image
                        src={mediaUrl(slide.item.coverImageKey)}
                        alt=""
                        fill
                        sizes={IMAGE_SIZES}
                        priority={activeIndex === 0}
                        className="object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/30">
                      <PizzaSliceIcon className="h-16 w-16" />
                    </div>
                  )}

                  {/* Badge sobre la foto solo en móvil; desde md va en la columna de texto
                      para no tapar el contenido de los flyers de promo. */}
                  <CollectionBadge slide={slide} className="absolute top-3 left-3 inline-flex shadow-lg sm:top-4 sm:left-4 md:hidden" />
                  {slides.length > 1 && (
                    <span
                      className="absolute top-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white tabular-nums backdrop-blur-sm sm:top-4 sm:right-4 md:hidden"
                      aria-hidden="true"
                    >
                      {activeIndex + 1} / {slides.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Info del producto */}
              <div key={`${activeIndex}-info`} className="animate-hero-slide-in shrink-0 md:order-1 md:flex-1">
                <CollectionBadge slide={slide} className="mb-4 hidden md:inline-flex" />
                <div className="flex items-baseline justify-between gap-3 md:block">
                  <h3 className="min-w-0 truncate font-display text-2xl leading-tight tracking-wide text-white sm:text-3xl md:text-5xl md:leading-none md:whitespace-normal lg:text-6xl">
                    {name}
                  </h3>
                  {priceLabel && (
                    <p className="shrink-0 font-display text-xl text-brand-yellow tabular-nums sm:text-2xl md:mt-4 md:text-3xl">
                      {priceLabel}
                    </p>
                  )}
                </div>
                {description && (
                  <p className="mt-1 line-clamp-1 text-sm text-white/70 sm:text-base md:mt-4 md:line-clamp-3 md:max-w-md md:leading-relaxed">
                    {description}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-3 md:mt-8">
                  <button
                    type="button"
                    onClick={() => onOpen(slide.item)}
                    className="btn-shine inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-brand-red px-7 text-sm font-semibold text-white shadow-glow-red transition-all duration-300 hover:scale-[1.03] hover:bg-brand-red-deep active:scale-95 md:flex-none"
                  >
                    {ui.viewDetails}
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                  {slides.length > 1 && (
                    <div className="hidden gap-2 md:flex">
                      <ArrowButton label={ui.prev} onClick={() => goTo(activeIndex - 1)}>
                        <ChevronLeftIcon className="h-5 w-5" />
                      </ArrowButton>
                      <ArrowButton label={ui.next} onClick={() => goTo(activeIndex + 1)}>
                        <ChevronRightIcon className="h-5 w-5" />
                      </ArrowButton>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Pie: barras de progreso (una por slide, también son navegación) + pista de scroll */}
        <footer className="flex shrink-0 flex-col items-center pb-1 md:pb-2">
          {!loading && slides.length > 1 && (
            <div className="flex w-full max-w-md gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={`${s.badgeKind}-${s.item.id}-${i}`}
                  type="button"
                  aria-label={`${ui.viewDetails}: ${displayName(s.item, lang)}`}
                  aria-current={i === activeIndex}
                  onClick={() => goTo(i)}
                  className="group flex h-8 flex-1 cursor-pointer items-center"
                >
                  <span className="relative h-1 w-full overflow-hidden rounded-full bg-white/20 transition-colors group-hover:bg-white/35">
                    {i < activeIndex && <span className="absolute inset-0 rounded-full bg-white/70" />}
                    {i === activeIndex && (
                      <span
                        key={activeIndex}
                        className="animate-hero-progress absolute inset-0 origin-left rounded-full bg-brand-yellow"
                        style={{
                          animationDuration: `${AUTOPLAY_MS}ms`,
                          animationPlayState: isPaused ? "paused" : "running",
                        }}
                        onAnimationEnd={() => goTo(activeIndex + 1)}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
          <ArrowDownIcon className="animate-float-down h-4 w-4 text-white/40" />
        </footer>
      </div>
    </div>
  );
}

interface CollectionBadgeProps {
  slide: HeroSlide;
  /** Incluye el `display` (inline-flex / hidden): varía por breakpoint según dónde se monte. */
  className: string;
}

function CollectionBadge({ slide, className }: CollectionBadgeProps) {
  const isFeatured = slide.badgeKind === "featured";
  return (
    <span
      className={`items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase sm:text-xs ${
        isFeatured ? "bg-brand-yellow text-ink" : "bg-brand-red text-white"
      } ${className}`}
    >
      {isFeatured ? <StarIcon className="h-3.5 w-3.5" /> : <FlameIcon className="h-3.5 w-3.5" />}
      {slide.badgeLabel}
    </span>
  );
}

interface ArrowButtonProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}

function ArrowButton({ label, onClick, children }: ArrowButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-sm transition-colors duration-200 hover:bg-white/25"
    >
      {children}
    </button>
  );
}

/** Mismo esqueleto que el escenario real: foto flexible + bloque de info. */
function StageSkeleton() {
  return (
    <>
      <div
        className="min-h-0 w-full flex-1 animate-pulse rounded-[1.75rem] bg-white/10 md:order-2 md:h-full md:max-w-[55%] md:flex-none md:aspect-[4/5]"
        aria-hidden="true"
      />
      <div className="shrink-0 animate-pulse space-y-3 md:order-1 md:flex-1" aria-hidden="true">
        <div className="h-8 w-2/3 rounded-lg bg-white/10" />
        <div className="h-4 w-full max-w-md rounded bg-white/10" />
        <div className="h-12 w-full rounded-full bg-white/10 md:w-44" />
      </div>
    </>
  );
}
