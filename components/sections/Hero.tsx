import HeroCarousel from "@/components/ui/HeroCarousel";
import OpenBadge from "@/components/ui/OpenBadge";
import { heroImages } from "@/lib/heroImages";
import { siteConfig } from "@/lib/siteConfig";

/**
 * Hero a pantalla completa con carrusel de fotos del negocio,
 * badge dinámico de horario y CTAs principales.
 */
export default function Hero() {
  return (
    <section id="inicio" className="relative flex min-h-svh items-center justify-center">
      <HeroCarousel images={heroImages} />

      <div className="relative z-10 mx-auto max-w-4xl px-4 pt-16 text-center">
        <OpenBadge />

        <h1 className="mt-6 font-display text-5xl leading-none tracking-wide text-white drop-shadow-lg sm:text-7xl md:text-8xl">
          Pizzería{" "}
          <span className="text-brand-yellow">Sabor</span>{" "}
          <span className="text-brand-red">Llanero</span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base text-white/90 drop-shadow sm:text-lg md:text-xl">
          {siteConfig.slogan}. Tradición familiar, masa artesanal y la fusión
          de Venezuela y Perú en cada porción, aquí en Ocucaje.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <a
            href={siteConfig.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-full bg-brand-red px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-red/30 transition-all duration-300 hover:scale-105 hover:bg-[#b51226] sm:w-auto"
          >
            📍 Cómo llegar
          </a>
          <a
            href={siteConfig.whatsapp.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-full bg-white/10 px-8 py-3.5 text-base font-semibold text-white ring-2 ring-white/60 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white hover:text-brand-blue sm:w-auto"
          >
            💬 Escríbenos
          </a>
        </div>
      </div>
    </section>
  );
}
