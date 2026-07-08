import HeroCarousel from "@/components/ui/HeroCarousel";
import MenuCta from "@/components/ui/MenuCta";
import OpenBadge from "@/components/ui/OpenBadge";
import ParticlesCanvas from "@/components/ui/ParticlesCanvas";
import Reveal from "@/components/ui/Reveal";
import { ArrowDownIcon, MapPinIcon, StarIcon, WhatsAppIcon } from "@/components/ui/icons";
import { heroImages } from "@/lib/heroImages";
import { siteConfig } from "@/lib/siteConfig";

/**
 * Hero split: titular + CTAs a la izquierda, tarjeta vertical
 * (formato póster 2:3) con carrusel de productos reales a la derecha.
 * Fondo carbón con brasas flotantes — adaptado a fotos verticales.
 */
export default function Hero() {
  return (
    <section
      id="inicio"
      className="texture-dots-light relative flex min-h-svh items-center overflow-hidden bg-charcoal"
    >
      {/* Resplandores de horno */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-brand-yellow/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-40 -bottom-40 h-[30rem] w-[30rem] rounded-full bg-brand-red/15 blur-3xl"
        aria-hidden="true"
      />

      {/* Brasas flotantes (efecto horno de leña) */}
      <div className="pointer-events-none absolute inset-0 z-[5]">
        <ParticlesCanvas />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-24 pb-16 md:grid-cols-[1.15fr_1fr] md:gap-12 md:px-6 md:pt-28">
        {/* Columna izquierda: mensaje y CTAs */}
        <div className="text-center md:text-left">
          <Reveal>
            <OpenBadge />
          </Reveal>

          <Reveal delay={100}>
            <h1 className="mt-6 font-display text-6xl leading-[0.95] tracking-wide text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] sm:text-7xl lg:text-8xl">
              <span className="block text-2xl tracking-[0.3em] text-white/75 sm:text-3xl">
                Pizzería
              </span>
              <span className="text-brand-yellow">Sabor</span>{" "}
              <span className="text-brand-red [text-shadow:0_0_40px_rgba(207,20,43,0.45)]">
                Llanero
              </span>
            </h1>
          </Reveal>

          <Reveal delay={220}>
            <p className="mx-auto mt-6 max-w-xl text-base text-white/85 sm:text-lg md:mx-0 md:text-xl">
              {siteConfig.slogan}. Masa hecha a mano, horno encendido y la fusión
              de <strong className="font-semibold text-brand-yellow">Venezuela</strong> y{" "}
              <strong className="font-semibold text-white">Perú</strong> en cada porción.
            </p>
          </Reveal>

          {/* Prueba social compacta */}
          <Reveal delay={320}>
            <div className="mt-5 flex items-center justify-center gap-1.5 text-sm text-white/75 md:justify-start">
              <span className="flex gap-0.5 text-brand-yellow" aria-hidden="true">
                <StarIcon className="h-4 w-4" />
                <StarIcon className="h-4 w-4" />
                <StarIcon className="h-4 w-4" />
                <StarIcon className="h-4 w-4" />
                <StarIcon className="h-4 w-4" />
              </span>
              Reseñas reales en Google
            </div>
          </Reveal>

          <Reveal delay={420}>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center md:justify-start sm:gap-4">
            {/* CTA primario: la carta en su ruta dedicada */}
            <MenuCta label="Ver el menú" className="w-full sm:w-auto" />
            <a
              href={siteConfig.whatsapp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-white/10 px-9 py-4 text-base font-semibold text-white ring-2 ring-white/50 backdrop-blur-md transition-all duration-300 hover:scale-[1.04] hover:bg-white hover:text-brand-blue active:scale-95 sm:w-auto"
            >
              <WhatsAppIcon className="h-5 w-5" />
              Escríbenos
            </a>
            <a
              href={siteConfig.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-white/10 px-9 py-4 text-base font-semibold text-white ring-2 ring-white/50 backdrop-blur-md transition-all duration-300 hover:scale-[1.04] hover:bg-white hover:text-brand-blue active:scale-95 sm:w-auto"
            >
              <MapPinIcon className="h-5 w-5" />
              Cómo llegar
            </a>
          </div>
          </Reveal>
        </div>

        {/* Columna derecha: tarjeta vertical con productos reales */}
        <Reveal delay={200} className="relative mx-auto w-full max-w-[17rem] sm:max-w-[19rem] lg:max-w-[21rem]">
          {/* Marco tricolor difuminado */}
          <div
            className="absolute -inset-2 rounded-[2rem] opacity-60"
            style={{
              background:
                "linear-gradient(140deg, #ffce00 0%, #00247d 50%, #cf142b 100%)",
              filter: "blur(14px)",
            }}
            aria-hidden="true"
          />
          <div className="relative aspect-[2/3] overflow-hidden rounded-[1.75rem] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/15 md:rotate-2 md:transition-transform md:duration-500 md:hover:rotate-0">
            <HeroCarousel images={heroImages} />
          </div>
        </Reveal>
      </div>

      {/* Indicador de scroll */}
      <a
        href="#nosotros"
        aria-label="Bajar a la sección Nosotros"
        className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 text-white/70 transition-colors hover:text-brand-yellow md:block"
      >
        <ArrowDownIcon className="animate-float-down h-7 w-7" />
      </a>
    </section>
  );
}
