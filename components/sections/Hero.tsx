import HeroCarousel from "@/components/ui/HeroCarousel";
import OpenBadge from "@/components/ui/OpenBadge";
import ParticlesCanvas from "@/components/ui/ParticlesCanvas";
import { ArrowDownIcon, MapPinIcon, WhatsAppIcon, StarIcon } from "@/components/ui/icons";
import { heroImages } from "@/lib/heroImages";
import { siteConfig } from "@/lib/siteConfig";

/**
 * Hero a pantalla completa: carrusel con efecto Ken Burns,
 * badge dinámico de horario, titular tricolor y CTAs.
 */
export default function Hero() {
  return (
    <section id="inicio" className="relative flex min-h-svh items-center justify-center">
      <HeroCarousel images={heroImages} />

      {/* Brasas flotantes sobre el carrusel (efecto horno de leña) */}
      <div className="pointer-events-none absolute inset-0 z-[5]">
        <ParticlesCanvas />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 pt-20 pb-24 text-center">
        <OpenBadge />

        <h1 className="mt-7 font-display text-6xl leading-[0.95] tracking-wide text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] sm:text-7xl md:text-8xl lg:text-9xl">
          <span className="block text-2xl tracking-[0.3em] text-white/80 sm:text-3xl">
            Pizzería
          </span>
          <span className="text-brand-yellow">Sabor</span>{" "}
          <span className="text-brand-red [text-shadow:0_0_40px_rgba(207,20,43,0.45)]">
            Llanero
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base text-white/85 drop-shadow sm:text-lg md:text-xl">
          {siteConfig.slogan}. Masa hecha a mano, horno encendido y la fusión
          de <strong className="font-semibold text-brand-yellow">Venezuela</strong> y{" "}
          <strong className="font-semibold text-white">Perú</strong> en cada porción.
        </p>

        {/* Prueba social compacta */}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-sm text-white/80">
          <span className="flex gap-0.5 text-brand-yellow" aria-hidden="true">
            <StarIcon className="h-4 w-4" />
            <StarIcon className="h-4 w-4" />
            <StarIcon className="h-4 w-4" />
            <StarIcon className="h-4 w-4" />
            <StarIcon className="h-4 w-4" />
          </span>
          Reseñas reales en Google
        </div>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <a
            href={siteConfig.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-shine inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-brand-red px-9 py-4 text-base font-semibold text-white shadow-glow-red transition-all duration-300 hover:scale-[1.04] hover:bg-brand-red-deep active:scale-95 sm:w-auto"
          >
            <MapPinIcon className="h-5 w-5" />
            Cómo llegar
          </a>
          <a
            href={siteConfig.whatsapp.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-white/10 px-9 py-4 text-base font-semibold text-white ring-2 ring-white/50 backdrop-blur-md transition-all duration-300 hover:scale-[1.04] hover:bg-white hover:text-brand-blue active:scale-95 sm:w-auto"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Escríbenos
          </a>
        </div>
      </div>

      {/* Indicador de scroll */}
      <a
        href="#nosotros"
        aria-label="Bajar a la sección Nosotros"
        className="absolute bottom-20 left-1/2 z-10 hidden -translate-x-1/2 text-white/70 transition-colors hover:text-brand-yellow md:block"
      >
        <ArrowDownIcon className="animate-float-down h-7 w-7" />
      </a>
    </section>
  );
}
