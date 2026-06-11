"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import SectionHeading from "@/components/ui/SectionHeading";
import Reveal from "@/components/ui/Reveal";
import { GoogleIcon, StarIcon } from "@/components/ui/icons";
import { siteConfig } from "@/lib/siteConfig";

/**
 * Reseñas reales de Google vía widget de Featurable.
 * Sección en fondo claro con texto oscuro: las cards blancas del
 * widget siempre contrastan bien.
 *
 * NOTA: el modo "carrusel automático" se activa desde el panel de
 * Featurable (featurable.com → tu widget → Layout → Carousel).
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
      className="texture-dots relative overflow-hidden bg-cream bg-linear-to-b from-cream to-white py-24 md:py-32"
    >
      {/* Acentos tricolor suaves de fondo */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-brand-yellow/15 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-brand-blue/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeading
          kicker="Reseñas"
          title="Lo Que Dicen Nuestros Clientes"
          subtitle="Opiniones reales de Google — gracias por tanta confianza"
        />

        {/* Sello de confianza Google */}
        <Reveal delay={150}>
          <div className="mx-auto -mt-8 mb-10 flex w-fit items-center gap-2.5 rounded-full border border-ink/8 bg-white px-5 py-2.5 shadow-card md:-mt-12">
            <GoogleIcon className="h-5 w-5 text-brand-blue" />
            <span className="flex gap-0.5 text-brand-yellow-deep" aria-hidden="true">
              <StarIcon className="h-4 w-4" />
              <StarIcon className="h-4 w-4" />
              <StarIcon className="h-4 w-4" />
              <StarIcon className="h-4 w-4" />
              <StarIcon className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-ink">Reseñas verificadas de Google</span>
          </div>
        </Reveal>

        <Reveal delay={250}>
          <div className="relative min-h-48">
            {/* Skeleton de carga elegante mientras llega el script */}
            {!loaded && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`animate-pulse rounded-2xl border border-ink/5 bg-white p-6 shadow-card ${
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
        </Reveal>
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
