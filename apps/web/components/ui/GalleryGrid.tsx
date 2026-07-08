"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { CloseIcon, ExpandIcon } from "@/components/ui/icons";
import type { SiteImage } from "@/types";

interface GalleryGridProps {
  images: SiteImage[];
}

/**
 * Grid responsivo de fotos con zoom sutil al hover, overlay con
 * caption y un lightbox ligero implementado sin librerías.
 */
export default function GalleryGrid({ images }: GalleryGridProps) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  const close = useCallback(() => setLightbox(null), []);

  // Escape cierra; flechas navegan
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight")
        setLightbox((i) => (i === null ? null : (i + 1) % images.length));
      if (e.key === "ArrowLeft")
        setLightbox((i) => (i === null ? null : (i - 1 + images.length) % images.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, images.length, close]);

  // Imagen activa del lightbox (narrowing explícito por noUncheckedIndexedAccess)
  const activeImage = lightbox !== null ? images[lightbox] : undefined;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-5">
        {images.map((image, i) => (
          <button
            key={image.src}
            type="button"
            onClick={() => setLightbox(i)}
            className="group relative aspect-[2/3] overflow-hidden rounded-2xl ring-1 ring-white/10 transition-all duration-300 hover:ring-brand-yellow/60 focus-visible:outline-2 focus-visible:outline-brand-yellow"
            aria-label={`Ampliar foto: ${image.alt}`}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 33vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            />
            {/* Overlay con caption al hover */}
            <span className="absolute inset-0 flex items-end bg-linear-to-t from-black/80 via-black/10 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <span className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-white">
                {image.alt}
                <ExpandIcon className="h-4 w-4 shrink-0 text-brand-yellow" />
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* Lightbox ligero */}
      {activeImage && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions --
        // click en el fondo para cerrar es solo un atajo de mouse; el cierre por teclado ya
        // existe vía el listener de Escape en el useEffect de arriba.
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={activeImage.alt}
          onClick={close}
        >
          <button
            type="button"
            className="absolute top-4 right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-brand-red"
            aria-label="Cerrar"
            onClick={close}
          >
            <CloseIcon className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions --
              onClick aquí solo detiene la propagación hacia el fondo (evita cerrar el lightbox
              al hacer click sobre la imagen); no es un control interactivo. */}
          <figure
            className="relative h-[80vh] w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={activeImage.src}
              alt={activeImage.alt}
              fill
              sizes="100vw"
              className="object-contain"
            />
            <figcaption className="absolute inset-x-0 -bottom-2 translate-y-full text-center text-sm text-white/70">
              {activeImage.alt}
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
