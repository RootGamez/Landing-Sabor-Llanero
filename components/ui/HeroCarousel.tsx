"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { SiteImage } from "@/types";

const AUTOPLAY_MS = 5000;

interface HeroCarouselProps {
  images: SiteImage[];
}

/**
 * Carrusel a pantalla completa con transición fade.
 * Autoplay (~5s), pausa al hover, swipe en móvil y dots de posición.
 * Implementado sin librerías externas.
 */
export default function HeroCarousel({ images }: HeroCarouselProps) {
  const [current, setCurrent] = useState(0);
  const paused = useRef(false);
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback(
    (index: number) => setCurrent((index + images.length) % images.length),
    [images.length],
  );

  // Autoplay con pausa al hover
  useEffect(() => {
    const interval = setInterval(() => {
      if (!paused.current) setCurrent((c) => (c + 1) % images.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(interval);
  }, [images.length]);

  // Swipe táctil en móvil
  const onTouchStart = (e: React.TouchEvent): void => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent): void => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) goTo(delta < 0 ? current + 1 : current - 1);
    touchStartX.current = null;
  };

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="region"
      aria-label="Galería de fotos del local"
    >
      {images.map((image, i) => (
        <div
          key={image.src}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={i !== current}
        >
          <Image
            src={image.src}
            alt={image.alt}
            fill
            priority={i === 0}
            sizes="100vw"
            className={`object-cover ${i === current ? "animate-ken-burns" : ""}`}
          />
        </div>
      ))}

      {/* Overlay oscuro degradado para legibilidad del texto */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/35 to-black/75" />

      {/* Dots de posición */}
      <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 gap-2.5">
        {images.map((image, i) => (
          <button
            key={image.src}
            type="button"
            aria-label={`Ir a la foto ${i + 1}`}
            aria-current={i === current}
            onClick={() => goTo(i)}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              i === current ? "w-8 bg-brand-yellow" : "w-2.5 bg-white/50 hover:bg-white/80"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
