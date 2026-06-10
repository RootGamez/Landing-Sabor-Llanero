"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import SectionHeading from "@/components/ui/SectionHeading";
import { siteConfig } from "@/lib/siteConfig";

/**
 * Reseñas reales de Google vía widget de Featurable.
 *
 * NOTA: el modo "carrusel automático" del widget se activa desde el
 * panel de Featurable (featurable.com → tu widget → Layout → Carousel
 * con autoplay). Este componente solo renderiza el contenedor y carga
 * el script una única vez con next/script (lazyOnload), de forma
 * segura para la hidratación de React.
 */
export default function GoogleReviews() {
  const [loaded, setLoaded] = useState(false);

  // Si el script ya estaba en caché y pobló el widget antes del evento
  // onLoad, ocultamos el skeleton al detectar contenido en el contenedor.
  useEffect(() => {
    const el = document.getElementById(siteConfig.featurableId);
    if (!el) return;
    const observer = new MutationObserver(() => {
      if (el.childElementCount > 0) {
        setLoaded(true);
        observer.disconnect();
      }
    });
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="resenas"
      className="texture-dots-light relative overflow-hidden bg-gradient-to-b from-brand-blue to-brand-blue-deep py-24 md:py-32"
    >
      {/* Resplandores decorativos de marca */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-brand-yellow/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-brand-red/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeading
          kicker="Reseñas"
          title="Lo Que Dicen Nuestros Clientes"
          subtitle="Opiniones reales de Google — gracias por tanta confianza"
          light
        />

        <div className="relative min-h-48">
          {/* Skeleton de carga elegante mientras llega el script */}
          {!loaded && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`animate-pulse rounded-2xl bg-white/95 p-6 shadow-card ${
                    i > 0 ? "hidden sm:block" : ""
                  } ${i > 1 ? "sm:hidden lg:block" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-brand-blue/10" />
                    <div className="h-3 w-24 rounded bg-brand-blue/10" />
                  </div>
                  <div className="mt-4 h-3 w-20 rounded bg-brand-yellow/50" />
                  <div className="mt-3 space-y-2">
                    <div className="h-3 w-full rounded bg-brand-blue/10" />
                    <div className="h-3 w-4/5 rounded bg-brand-blue/10" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Contenedor del widget de Featurable (reseñas de Google) */}
          <div
            id={siteConfig.featurableId}
            data-featurable-async
            data-location-code="es"
            className={loaded ? "" : "absolute inset-0 opacity-0"}
          />
        </div>
      </div>

      <Script
        src="https://featurable.com/assets/bundle.js"
        strategy="lazyOnload"
        charSet="UTF-8"
        onLoad={() => setLoaded(true)}
      />
    </section>
  );
}
