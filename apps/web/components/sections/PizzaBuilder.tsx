"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Reveal from "@/components/ui/Reveal";
import { WhatsAppIcon } from "@/components/ui/icons";
import { builderImages } from "@/lib/builderImages";
import { siteConfig } from "@/lib/siteConfig";

/* ── Utilidades de animación ───────────────────────────── */
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const phase = (p: number, start: number, end: number): number =>
  clamp01((p - start) / (end - start));

const STEPS = [
  { title: "Masa artesanal", text: "Estirada a mano y reposada el tiempo justo" },
  { title: "Salsa de la casa", text: "Tomates frescos con un toque llanero" },
  { title: "Mozzarella generosa", text: "Queso de verdad, sin tacañería" },
  { title: "Ingredientes frescos", text: "Jamón, champiñones, maíz… al gusto" },
  { title: "Al horno y a tu mesa", text: "Borde dorado, queso burbujeante" },
] as const;

/**
 * Sección "scrollytelling" con FOTOS REALES: mientras el usuario
 * scrollea, la secuencia avanza por capas (masa → salsa → queso →
 * ingredientes → horneada) con crossfade y zoom sutil.
 * Sticky + requestAnimationFrame, sin librerías.
 * Con prefers-reduced-motion se muestra la pizza terminada, estática.
 */
export default function PizzaBuilder() {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(false);
  const ticking = useRef(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      setProgress(1);
      return;
    }

    const update = (): void => {
      ticking.current = false;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      setProgress(total > 0 ? clamp01(-rect.top / total) : 1);
    };

    const onScroll = (): void => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const p = progress;
  const stageCount = builderImages.length; // 5 etapas

  /**
   * Posición continua dentro de la secuencia (0 → 4).
   * El 0.92 deja un pequeño "respiro" al final con la pizza lista.
   */
  const stageF = Math.min(stageCount - 1, (p / 0.92) * (stageCount - 1));
  const activeStep = Math.min(stageCount - 1, Math.floor(stageF + 0.001));
  const endT = phase(p, 0.88, 0.98); // CTA + vapor al final

  return (
    <section
      ref={sectionRef}
      aria-label="Cómo preparamos tu pizza, paso a paso"
      className="relative bg-charcoal"
      style={{ height: reduced ? "auto" : "320vh" }}
    >
      <div
        className={`texture-dots-light flex flex-col justify-center overflow-hidden ${
          reduced ? "min-h-svh py-20" : "sticky top-0 h-svh"
        }`}
      >
        {/* Resplandor de horno al fondo */}
        <div
          className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-brand-red/15 blur-3xl"
          aria-hidden="true"
        />

        <div className="mx-auto grid w-full max-w-6xl items-center gap-5 px-4 md:grid-cols-[1fr_1.15fr] md:gap-12 md:px-6">
          {/* Columna izquierda: pasos */}
          <div>
            <Reveal delay={90}>
              <h2 className="font-display text-3xl leading-none tracking-wide text-white sm:text-5xl md:text-6xl">
                Así Nace Tu Pizza
              </h2>
            </Reveal>
            <Reveal delay={180}>
              <div className="mt-3 flex h-1.5 w-24 overflow-hidden rounded-full md:mt-4 md:w-28" aria-hidden="true">
                <span className="flex-1 bg-brand-yellow" />
                <span className="flex-1 bg-white" />
                <span className="flex-1 bg-brand-red" />
              </div>
            </Reveal>

            <ol className="mt-5 space-y-2 md:mt-10 md:space-y-4">
              {STEPS.map((step, i) => {
                const active = i <= activeStep;
                const current = i === activeStep;
                return (
                  <li
                    key={step.title}
                    className={`flex items-start gap-3 transition-all duration-500 md:gap-4 ${
                      active ? "opacity-100" : "opacity-35"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-base transition-all duration-500 md:h-9 md:w-9 md:text-lg ${
                        active ? "bg-brand-yellow text-ink" : "bg-white/10 text-white/60"
                      } ${current ? "scale-110 shadow-glow-yellow" : ""}`}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold leading-tight text-white">{step.title}</p>
                      <p className="text-sm leading-snug text-white/60">{step.text}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* CTA final: aparece cuando la pizza está lista */}
            <div
              className="mt-5 transition-all duration-500 md:mt-7"
              style={{
                opacity: endT,
                transform: `translateY(${(1 - endT) * 16}px)`,
                pointerEvents: endT > 0.5 ? "auto" : "none",
              }}
            >
              <a
                href={siteConfig.whatsapp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-shine inline-flex items-center gap-2.5 rounded-full bg-brand-red px-7 py-3 font-semibold text-white shadow-glow-red transition-transform duration-300 hover:scale-[1.04] active:scale-95 md:px-8 md:py-3.5"
              >
                <WhatsAppIcon className="h-5 w-5" />
                Pide la tuya ahora
              </a>
            </div>
          </div>

          {/* Columna derecha: secuencia real de fotos en marco circular */}
          <div className="relative mx-auto w-full max-w-[17rem] max-[639px]:[@media(max-height:730px)]:max-w-[13rem] sm:max-w-[20rem] md:max-w-[30rem]">
            {/* Imagen + aro tricolor: agrupados para que el efecto bandera
                quede ceñido a la pizza y no se solape con el texto de abajo. */}
            <div className="relative">
              {/* Aro tricolor decorativo */}
              <div
                className="absolute -inset-2 rounded-full opacity-70"
                style={{
                  background:
                    "conic-gradient(#ffce00 0deg 120deg, #00247d 120deg 240deg, #cf142b 240deg 360deg)",
                  filter: "blur(10px)",
                }}
                aria-hidden="true"
              />

              <div className="relative aspect-square overflow-hidden rounded-full shadow-[0_24px_80px_-20px_rgba(0,0,0,0.8)] ring-4 ring-white/10">
                {builderImages.map((image, i) => {
                  // Cada etapa hace fade-in encima de la anterior
                  const t = i === 0 ? 1 : clamp01(stageF - (i - 1));
                  const scale = 1.06 - 0.06 * t;
                  return (
                    <div
                      key={image.src}
                      className="absolute inset-0"
                      style={{ opacity: t, transform: `scale(${scale})` }}
                      aria-hidden={i !== activeStep}
                    >
                      <Image
                        src={image.src}
                        alt={image.alt}
                        fill
                        sizes="(max-width: 768px) 90vw, 480px"
                        className="object-cover"
                        priority={i === 0}
                      />
                    </div>
                  );
                })}

                {/* Vapor sobre la pizza horneada */}
                <svg
                  viewBox="0 0 200 200"
                  className="animate-steam pointer-events-none absolute inset-x-0 top-0 h-1/2 w-full"
                  style={{ opacity: endT * 0.8 }}
                  aria-hidden="true"
                >
                  <path d="M78 95 q -6 -14 2 -25 q 7 -10 1 -21" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
                  <path d="M100 90 q 8 -15 -1 -27 q -7 -10 1 -20" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
                  <path d="M124 95 q 6 -14 -2 -25 q -7 -10 -1 -21" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
                </svg>
              </div>
            </div>

            {/* Etiqueta de la etapa actual */}
            <p
              className="relative z-10 mt-3 text-center font-display text-xl tracking-wide text-brand-yellow md:mt-5 md:text-2xl"
              aria-live="polite"
            >
              {STEPS[activeStep].title}
            </p>

            {/* Barra de progreso del armado */}
            {!reduced && (
              <div className="mx-auto mt-3 hidden h-1.5 w-48 overflow-hidden rounded-full bg-white/10 md:block" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-linear-to-r from-brand-yellow via-white to-brand-red"
                  style={{ width: `${Math.round(p * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
