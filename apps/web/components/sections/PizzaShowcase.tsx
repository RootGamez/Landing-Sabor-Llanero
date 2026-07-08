import MenuCta from "@/components/ui/MenuCta";
import PizzaModelViewer from "@/components/ui/PizzaModelViewer";
import Reveal from "@/components/ui/Reveal";
import { StarIcon, WhatsAppIcon } from "@/components/ui/icons";
import { siteConfig } from "@/lib/siteConfig";

const ORDER_STEPS = [
  "Elige tu sabor y tamaño",
  "Escríbenos por WhatsApp",
  "Te la llevamos caliente a tu puerta",
] as const;

/**
 * Sección "Pide la tuya": tamaños reales, variedad de sabores y los
 * pasos para ordenar — junto al modelo 3D interactivo (Three.js).
 */
export default function PizzaShowcase() {
  return (
    <section
      id="pide"
      aria-label="Tamaños, sabores y cómo pedir"
      className="texture-dots-light relative overflow-hidden bg-brand-blue-ink bg-linear-to-b from-brand-blue-ink to-charcoal py-24 md:py-32"
    >
      {/* Resplandores */}
      <div
        className="pointer-events-none absolute top-10 -left-32 h-96 w-96 rounded-full bg-brand-yellow/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-10 h-96 w-96 rounded-full bg-brand-red/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 md:grid-cols-[1.15fr_1fr] md:gap-12 md:px-6">
        {/* Columna de contenido útil */}
        <div className="text-center md:text-left">
          <Reveal>
            <span className="mb-3 inline-block rounded-full bg-brand-yellow/15 px-4 py-1 text-xs font-semibold tracking-[0.2em] text-brand-yellow uppercase">
              Pide la tuya
            </span>
          </Reveal>
          <Reveal delay={90}>
            <h2 className="font-display text-5xl tracking-wide text-white sm:text-6xl md:text-7xl">
              Elige Tu <span className="text-brand-yellow">Tamaño</span>
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

          <Reveal delay={250}>
            <p className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/85 md:mx-0">
              <StarIcon className="h-4 w-4 text-brand-yellow" />
              {siteConfig.flavorsClaim}
            </p>
          </Reveal>

          {/* Tamaños con escala visual real */}
          <Reveal delay={320}>
            <div className="mt-7 grid grid-cols-3 gap-3 md:gap-4">
              {siteConfig.pizzaSizes.map((size) => (
                <div
                  key={size.name}
                  className={`group relative flex flex-col items-center rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 md:p-5 ${
                    size.featured
                      ? "border-brand-yellow/60 bg-brand-yellow/10 shadow-glow-yellow"
                      : "border-white/10 bg-white/5 hover:border-white/25"
                  }`}
                >
                  {size.featured && (
                    <span className="absolute -top-3 rounded-full bg-brand-yellow px-3 py-0.5 text-[10px] font-bold tracking-wider text-ink uppercase">
                      La favorita
                    </span>
                  )}
                  {/* Disco a escala del tamaño */}
                  <div
                    className="flex items-end justify-center"
                    style={{ height: 72 }}
                    aria-hidden="true"
                  >
                    <div
                      className="rounded-full border-4 border-[#b57a26] bg-linear-to-br from-[#f5c542] to-[#d99a3d] shadow-lg transition-transform duration-300 group-hover:scale-105"
                      style={{ width: 68 * size.scale, height: 68 * size.scale }}
                    />
                  </div>
                  <p className="mt-3 font-display text-xl tracking-wide text-white">
                    {size.name}
                  </p>
                  <p className="text-xs text-white/60">{size.detail}</p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Cómo pedir, en 3 pasos */}
          <Reveal delay={420}>
            <ol className="mt-8 space-y-3">
              {ORDER_STEPS.map((step, i) => (
                <li
                  key={step}
                  className="flex items-center justify-center gap-3 text-sm text-white/80 md:justify-start md:text-base"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-yellow font-display text-base text-ink">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal delay={520}>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start sm:gap-4">
              <a
                href={siteConfig.whatsapp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-shine inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-brand-red px-9 py-4 text-base font-semibold text-white shadow-glow-red transition-all duration-300 hover:scale-[1.04] hover:bg-brand-red-deep active:scale-95 sm:w-auto"
              >
                <WhatsAppIcon className="h-5 w-5" />
                Pedir por WhatsApp
              </a>
              <MenuCta variant="ghost" label="Ver carta completa" className="w-full sm:w-auto" />
            </div>
          </Reveal>
        </div>

        {/* Visor 3D */}
        <Reveal delay={200}>
          <div className="relative mx-auto w-full max-w-[20rem] sm:max-w-[24rem] md:max-w-[28rem]">
            {/* Sombra sobre la mesa */}
            <div
              className="absolute inset-x-[14%] bottom-[6%] h-[10%] rounded-full bg-black/70 blur-xl"
              aria-hidden="true"
            />
            <PizzaModelViewer />
            <p className="mt-2 text-center text-xs font-medium tracking-wide text-white/50">
              ↔ arrástrala para girarla
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}