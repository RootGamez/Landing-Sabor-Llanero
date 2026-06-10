"use client";

import { useEffect, useRef, useState } from "react";
import { WhatsAppIcon } from "@/components/ui/icons";
import { siteConfig } from "@/lib/siteConfig";

/* ── Utilidades de animación ───────────────────────────── */
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
/** Progreso normalizado de una sub-fase dentro del scroll total */
const phase = (p: number, start: number, end: number): number =>
  clamp01((p - start) / (end - start));
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

/* ── Ingredientes que caen (posiciones finales en el viewBox 640) ── */
interface Topping {
  x: number;
  y: number;
  r: number;
  kind: "pep" | "basil";
}

const TOPPINGS: Topping[] = [
  { x: 320, y: 245, r: 26, kind: "pep" },
  { x: 248, y: 300, r: 24, kind: "pep" },
  { x: 392, y: 298, r: 25, kind: "pep" },
  { x: 285, y: 372, r: 23, kind: "pep" },
  { x: 372, y: 370, r: 24, kind: "pep" },
  { x: 322, y: 318, r: 22, kind: "pep" },
  { x: 255, y: 232, r: 20, kind: "pep" },
  { x: 390, y: 235, r: 20, kind: "pep" },
  { x: 320, y: 428, r: 21, kind: "pep" },
  { x: 286, y: 264, r: 8, kind: "basil" },
  { x: 356, y: 262, r: 8, kind: "basil" },
  { x: 250, y: 338, r: 8, kind: "basil" },
  { x: 396, y: 340, r: 8, kind: "basil" },
  { x: 320, y: 392, r: 8, kind: "basil" },
  { x: 322, y: 208, r: 8, kind: "basil" },
];

const STEPS = [
  { title: "Masa artesanal", text: "Estirada a mano y reposada el tiempo justo" },
  { title: "Salsa de la casa", text: "Tomates frescos con un toque llanero" },
  { title: "Mozzarella generosa", text: "Queso de verdad, sin tacañería" },
  { title: "Ingredientes frescos", text: "Y directo al horno, a tu mesa" },
] as const;

/**
 * Sección "scrollytelling": mientras el usuario scrollea, la masa se
 * estira, cae la salsa, el queso y los ingredientes llueven por capas.
 * Implementado con position: sticky + requestAnimationFrame — sin librerías.
 * Con prefers-reduced-motion se muestra la pizza ya armada, sin animación.
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

  /* Fases del armado */
  const doughT = easeOut(phase(p, 0, 0.2)); // masa se estira
  const sauceT = easeOut(phase(p, 0.22, 0.4)); // salsa se expande
  const cheeseT = easeOut(phase(p, 0.42, 0.58)); // queso funde
  const endT = phase(p, 0.86, 0.97); // mensaje final

  const crustR = 96 + 134 * doughT; // 96 → 230
  const sauceR = 186 * sauceT;
  const cheeseR = 178 * cheeseT;

  const activeStep = p < 0.22 ? 0 : p < 0.42 ? 1 : p < 0.6 ? 2 : 3;

  return (
    <section
      ref={sectionRef}
      aria-label="Cómo preparamos tu pizza"
      className="relative bg-charcoal"
      style={{ height: reduced ? "auto" : "300vh" }}
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

        <div className="mx-auto grid w-full max-w-6xl items-center gap-6 px-4 md:grid-cols-[1fr_1.2fr] md:gap-10 md:px-6">
          {/* Columna izquierda: pasos */}
          <div>
            <span className="mb-3 inline-block rounded-full bg-brand-yellow/15 px-4 py-1 text-xs font-semibold tracking-[0.2em] text-brand-yellow uppercase">
              En vivo
            </span>
            <h2 className="font-display text-4xl tracking-wide text-white sm:text-5xl md:text-6xl">
              Así Nace Tu Pizza
            </h2>
            <div className="mt-4 flex h-1.5 w-28 overflow-hidden rounded-full" aria-hidden="true">
              <span className="flex-1 bg-brand-yellow" />
              <span className="flex-1 bg-white" />
              <span className="flex-1 bg-brand-red" />
            </div>

            <ol className="mt-8 space-y-3 md:mt-10 md:space-y-5">
              {STEPS.map((step, i) => {
                const active = i <= activeStep;
                return (
                  <li
                    key={step.title}
                    className={`flex items-start gap-4 transition-all duration-500 ${
                      active ? "opacity-100" : "opacity-35"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-lg transition-colors duration-500 ${
                        active ? "bg-brand-yellow text-ink" : "bg-white/10 text-white/60"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-white">{step.title}</p>
                      <p className="text-sm text-white/60">{step.text}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* CTA final: aparece cuando la pizza está lista */}
            <div
              className="mt-8 transition-all duration-500"
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
                className="btn-shine inline-flex items-center gap-2.5 rounded-full bg-brand-red px-8 py-3.5 font-semibold text-white shadow-glow-red transition-transform duration-300 hover:scale-[1.04] active:scale-95"
              >
                <WhatsAppIcon className="h-5 w-5" />
                Pide la tuya ahora
              </a>
            </div>
          </div>

          {/* Columna derecha: la pizza armándose */}
          <div className="relative mx-auto w-full max-w-[30rem]">
            <svg
              viewBox="0 0 640 640"
              role="img"
              aria-label="Pizza artesanal armándose capa por capa"
              className="h-auto w-full"
            >
              <defs>
                <radialGradient id="pbCheese" cx="45%" cy="42%" r="65%">
                  <stop offset="0%" stopColor="#FADD7A" />
                  <stop offset="100%" stopColor="#F5C542" />
                </radialGradient>
                <radialGradient id="pbGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FFCE00" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#FFCE00" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Resplandor + sombra */}
              <circle cx="320" cy="320" r={crustR * 1.5} fill="url(#pbGlow)" opacity={0.5 + doughT * 0.5} />
              <ellipse cx="320" cy={320 + crustR * 0.92} rx={crustR * 1.12} ry={crustR * 0.2} fill="#000" opacity="0.45" />

              {/* 1. Masa: de bola a base estirada */}
              <circle cx="320" cy="320" r={crustR} fill="#D99A3D" stroke="#B57A26" strokeWidth={crustR * 0.045} />
              <circle cx="320" cy="320" r={crustR * 0.86} fill="#E8B55C" opacity={1 - doughT * 0.55} />

              {/* 2. Salsa */}
              {sauceT > 0.01 && (
                <circle cx="320" cy="320" r={sauceR} fill="#C44D20" opacity={0.92} />
              )}

              {/* 3. Queso */}
              {cheeseT > 0.01 && (
                <circle cx="320" cy="320" r={cheeseR} fill="url(#pbCheese)" />
              )}

              {/* 4. Ingredientes cayendo desde arriba, escalonados */}
              {TOPPINGS.map((tItem, i) => {
                const delay = i / TOPPINGS.length;
                const tp = easeOut(phase(p, 0.58 + delay * 0.24, 0.7 + delay * 0.24));
                if (tp <= 0.01) return null;
                const offsetY = (1 - tp) * -460;
                const rot = (1 - tp) * (i % 2 === 0 ? 140 : -140);
                return (
                  <g
                    key={`${tItem.x}-${tItem.y}`}
                    transform={`translate(${tItem.x} ${tItem.y + offsetY}) rotate(${rot})`}
                    opacity={Math.min(1, tp * 2.5)}
                  >
                    {tItem.kind === "pep" ? (
                      <>
                        <circle r={tItem.r} fill="#C0392B" stroke="#8E2418" strokeWidth={tItem.r * 0.18} />
                        <circle r={tItem.r * 0.28} cx={-tItem.r * 0.25} cy={-tItem.r * 0.2} fill="#A92C20" />
                      </>
                    ) : (
                      <ellipse rx={tItem.r} ry={tItem.r * 0.65} fill="#3E7C3A" />
                    )}
                  </g>
                );
              })}

              {/* Vapor al final */}
              <g opacity={endT} className="animate-steam" style={{ transformOrigin: "320px 140px" }}>
                <path d="M280 150 q -10 -22 4 -40 q 12 -16 2 -34" fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity="0.35" />
                <path d="M320 142 q 12 -24 -2 -44 q -10 -16 2 -32" fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity="0.45" />
                <path d="M362 150 q 10 -22 -4 -40 q -12 -16 -2 -34" fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity="0.35" />
              </g>
            </svg>

            {/* Barra de progreso del armado */}
            {!reduced && (
              <div className="mx-auto mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-yellow via-white to-brand-red"
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
