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
}

/**
 * Carrusel accesible con CSS scroll-snap nativo (sin librerías, BLUEPRINT
 * fase 5): overflow-x + snap-x en el track, botones prev/next que hacen
 * scrollBy (respetando scroll-behavior smooth del html, que ya se apaga con
 * prefers-reduced-motion en globals.css). Los botones se deshabilitan en los
 * extremos. En touch se puede simplemente deslizar.
 */
export default function Carousel({ children, prevLabel, nextLabel, dark = false }: CarouselProps) {
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

      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-5"
      >
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
