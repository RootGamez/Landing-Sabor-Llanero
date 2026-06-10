"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import type { SiteImage } from "@/types";

interface GalleryGridProps {
  images: SiteImage[];
}

/**
 * Grid responsivo de fotos con zoom sutil al hover y un
 * lightbox ligero implementado sin librerías.
 */
export default function GalleryGrid({ images }: GalleryGridProps) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  const close = useCallback(() => setLightbox(null), []);

  // Cierra el lightbox con Escape y navega con flechas
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setLightbox((i) => (i === null ? null : (i + 1) % images.length));
      if (e.key === "ArrowLeft")
        setLightbox((i) => (i === null ? null : (i - 1 + images.length) % images.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, images.length, close]);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {images.map((image, i) => (
          <button
            key={image.src}
            type="button"
            onClick={() => setLightbox(i)}
            className="group relative aspect-square overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-brand-red"
            aria-label={`Ampliar foto: ${image.alt}`}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <span className="absolute inset-0 bg-brand-blue/0 transition-colors duration-300 group-hover:bg-brand-blue/20" />
          </button>
        ))}
      </div>

      {/* Lightbox ligero */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={images[lightbox].alt}
          onClick={close}
        >
          <button
            type="button"
            className="absolute top-4 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl text-white transition-colors hover:bg-brand-red"
            aria-label="Cerrar"
            onClick={close}
          >
            ✕
          </button>
          <div
            className="relative h-[80vh] w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[lightbox].src}
              alt={images[lightbox].alt}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
