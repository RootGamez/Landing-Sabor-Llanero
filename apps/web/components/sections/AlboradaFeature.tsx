import Image from "next/image";
import MenuCta from "@/components/ui/MenuCta";
import Reveal from "@/components/ui/Reveal";
import { WhatsAppIcon } from "@/components/ui/icons";
import { siteConfig } from "@/lib/siteConfig";

const INGREDIENTS = ["Mozzarella", "Tocino ahumado", "Maíz tierno", "Champiñones"];

/**
 * Sección estrella post-builder: la Pizza Alborada real, a gran
 * tamaño — es la misma que el usuario "armó" scrolleando arriba.
 */
export default function AlboradaFeature() {
  return (
    <section
      id="alborada"
      aria-label="Pizza Alborada, nuestra especialidad"
      className="relative overflow-hidden bg-charcoal bg-linear-to-b from-charcoal to-brand-blue-ink py-24 md:py-32"
    >
      {/* Resplandor dorado de amanecer (alborada) */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 h-[28rem] w-[60rem] -translate-x-1/2 rounded-full bg-brand-yellow/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 md:grid-cols-[1fr_1.1fr] md:gap-16 md:px-6">
        {/* Foto real vertical, protagonista */}
        <Reveal>
          <div className="relative mx-auto w-full max-w-md">
            <div
              className="absolute -inset-3 -rotate-2 rounded-[2rem] bg-linear-to-br from-brand-yellow via-brand-red to-brand-blue opacity-70"
              aria-hidden="true"
            />
            <div className="relative aspect-[3/4] overflow-hidden rounded-[1.75rem] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9)]">
              <Image
                src={siteConfig.media.alborada}
                alt="Pizza Alborada de Sabor Llanero: mozzarella, tocino ahumado, maíz tierno y champiñones, recién salida del horno"
                fill
                sizes="(max-width: 768px) 92vw, 460px"
                className="object-cover transition-transform duration-700 hover:scale-105"
              />
            </div>
            {/* Badge precio */}
            <span className="absolute -top-4 right-4 rounded-full bg-brand-red px-5 py-2 font-display text-xl tracking-wide text-white shadow-glow-red md:-right-4">
              Desde S/ 29
            </span>
          </div>
        </Reveal>

        {/* Copy — textos en cascada */}
        <div className="text-center md:text-left">
          <Reveal>
            <span className="mb-3 inline-block rounded-full bg-brand-yellow/15 px-4 py-1 text-xs font-semibold tracking-[0.2em] text-brand-yellow uppercase">
              El resultado
            </span>
          </Reveal>
          <Reveal delay={90}>
            <h2 className="font-display text-5xl tracking-wide text-white sm:text-6xl md:text-7xl">
              Pizza <span className="text-brand-yellow">Alborada</span>
            </h2>
          </Reveal>
          <Reveal delay={180}>
            <div
              className="mx-auto mt-4 flex h-1.5 w-28 overflow-hidden rounded-full md:mx-0"
              aria-hidden="true"
            >
              <span className="flex-1 bg-brand-yellow" />
              <span className="flex-1 bg-white" />
              <span className="flex-1 bg-brand-red" />
            </div>
          </Reveal>

          <Reveal delay={260}>
            <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-white/80 md:mx-0 md:text-lg">
              La que acabas de ver nacer, capa por capa. Nuestra creación
              gourmet insignia: generosa, dorada y con ese borde crocante que
              solo da el horno bien caliente.
            </p>
          </Reveal>

          {/* Ingredientes */}
          <ul className="mt-7 flex flex-wrap justify-center gap-2.5 md:justify-start">
            {INGREDIENTS.map((ing, i) => (
              <li key={ing}>
                <Reveal delay={340 + i * 80}>
                  <span className="inline-block rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/90">
                    {ing}
                  </span>
                </Reveal>
              </li>
            ))}
          </ul>

          <Reveal delay={620}>
            <p className="mt-4 text-sm text-white/55">
              Disponible en tamaño Familiar, Grande y Mediana.
            </p>
          </Reveal>

          <Reveal delay={700}>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start sm:gap-4">
              <a
                href={siteConfig.whatsapp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-shine inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-brand-red px-9 py-4 text-base font-semibold text-white shadow-glow-red transition-all duration-300 hover:scale-[1.04] hover:bg-brand-red-deep active:scale-95 sm:w-auto"
              >
                <WhatsAppIcon className="h-5 w-5" />
                Pedir mi Alborada
              </a>
              <MenuCta variant="ghost" className="w-full sm:w-auto" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
