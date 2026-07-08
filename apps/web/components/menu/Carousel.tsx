"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

interface CarouselProps {
  children: ReactNode;
  /** aria-labels bilingües de los botones. */
  prevLabel: string;
  nextLabel: string;
  /** Variante de color de los botones para fondos oscuros. */
  dark?: boolean;
  /** Título del rail (si existe) para el aria-label del track. */
  railTitle?: string;
}

/**
 * Carrusel accesible con CSS scroll-snap nativo (sin librerías, BLUEPRINT
 * fase 5): overflow-x + snap-x en el track, botones prev/next que hacen
 * scrollBy (respetando scroll-behavior smooth del html, que ya se apaga con
 * prefers-reduced-motion en globals.css). Los botones se deshabilitan en los
 * extremos. En touch se puede simplemente deslizar. Bajo 768px los botones
 * prev/next se ocultan, así que el track también es operable con teclado
 * (Flecha izq/der) para no depender solo del gesto de swipe.
 */
export default function Carousel({
  children,
  prevLabel,
  nextLabel,
  dark = false,
  railTitle,
}: CarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    setCanPrev(track.scrollLeft > 4);
    setCanNext(track.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateArrows();
    track.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(track);
    return () => {
      track.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows]);

  const scrollByPage = (direction: 1 | -1): void => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: "smooth" });
  };

  // Navegación por teclado del track: necesaria porque los botones prev/next
  // se ocultan bajo 768px (hidden md:flex) y el track no era operable ni
  // anunciado por lectores de pantalla.
  const onTrackKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollByPage(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollByPage(-1);
    }
  };

  const buttonClasses = `absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full shadow-md transition-all duration-200 disabled:cursor-default disabled:opacity-0 md:flex ${
    dark
      ? "bg-white/10 text-white backdrop-blur-sm hover:bg-white/25"
      : "border border-ink/5 bg-white text-ink hover:bg-brand-yellow hover:text-ink"
  }`;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={prevLabel}
        disabled={!canPrev}
        onClick={() => scrollByPage(-1)}
        className={`${buttonClasses} -left-3 lg:-left-5`}
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>

      {
        /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex --
           patrón WAI-ARIA para regiones desplazables: role="region" + tabIndex={0} + flechas de
           teclado es lo que hace operable el track cuando los botones prev/next se ocultan
           (hidden md:flex, ver el comentario del componente arriba). */
      }
      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carrusel"
        aria-label={railTitle}
        tabIndex={0}
        onKeyDown={onTrackKeyDown}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-5"
      >
        {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
        {children}
      </div>

      <button
        type="button"
        aria-label={nextLabel}
        disabled={!canNext}
        onClick={() => scrollByPage(1)}
        className={`${buttonClasses} -right-3 lg:-right-5`}
      >
        <ChevronRightIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
