import Image from "next/image";
import Reveal from "@/components/ui/Reveal";
import { StarIcon, WhatsAppIcon } from "@/components/ui/icons";
import { siteConfig } from "@/lib/siteConfig";

/**
 * Banner del producto más vendido: los tequeños venezolanos.
 * Foto horizontal real sobre fondo crema cálido.
 */
export default function TequenosFeature() {
  return (
    <section
      aria-label="Tequeños, nuestro producto más vendido"
      className="texture-dots overflow-hidden bg-cream py-24 md:py-32"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-2 md:gap-16 md:px-6">
        {/* Copy */}
        <Reveal>
          <div className="text-center md:text-left">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-yellow px-4 py-1.5 text-xs font-bold tracking-[0.15em] text-ink uppercase shadow-glow-yellow">
              <StarIcon className="h-3.5 w-3.5" />
              El más vendido
            </span>
            <h2 className="font-display text-5xl tracking-wide text-ink sm:text-6xl">
              Tequeños <span className="text-brand-red">Crocantes</span>
            </h2>
            <div
              className="mx-auto mt-4 flex h-1.5 w-28 overflow-hidden rounded-full md:mx-0"
              aria-hidden="true"
            >
              <span className="flex-1 bg-brand-yellow" />
              <span className="flex-1 bg-brand-blue" />
              <span className="flex-1 bg-brand-red" />
            </div>

            <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-ink/75 md:mx-0 md:text-lg">
              El clásico venezolano que conquistó Ocucaje: masa dorada y
              crujiente, queso que se estira y nuestra salsa de la casa.
              Pídelos solos o de acompañante — no falla.
            </p>

            <ul className="mt-6 space-y-2 text-sm text-ink/70">
              <li className="flex items-center justify-center gap-2 md:justify-start">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-red" aria-hidden="true" />
                Hechos a mano, fritos al momento
              </li>
              <li className="flex items-center justify-center gap-2 md:justify-start">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-blue" aria-hidden="true" />
                Perfectos para compartir en familia
              </li>
              <li className="flex items-center justify-center gap-2 md:justify-start">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-yellow" aria-hidden="true" />
                Combínalos con tu pizza favorita
              </li>
            </ul>

            <a
              href={siteConfig.whatsapp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-shine mt-8 inline-flex items-center gap-2.5 rounded-full bg-brand-red px-9 py-4 text-base font-semibold text-white shadow-glow-red transition-all duration-300 hover:scale-[1.04] hover:bg-brand-red-deep active:scale-95"
            >
              <WhatsAppIcon className="h-5 w-5" />
              Pedir tequeños
            </a>
          </div>
        </Reveal>

        {/* Foto horizontal real */}
        <Reveal delay={150}>
          <div className="relative">
            <div
              className="absolute -inset-3 rotate-1 rounded-[2rem] bg-gradient-to-br from-brand-yellow via-brand-blue to-brand-red opacity-60"
              aria-hidden="true"
            />
            <div className="relative aspect-[16/10] overflow-hidden rounded-[1.75rem] shadow-card-hover">
              <Image
                src={siteConfig.media.tequenos}
                alt="Plato de tequeños venezolanos dorados con salsa de la casa en Sabor Llanero"
                fill
                sizes="(max-width: 768px) 92vw, 560px"
                className="object-cover transition-transform duration-700 hover:scale-105"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
