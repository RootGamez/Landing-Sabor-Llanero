import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { siteConfig } from "@/lib/siteConfig";

/**
 * Sección Nosotros: historia breve y emotiva del negocio familiar.
 * El texto es placeholder editable — cámbialo libremente.
 */
export default function About() {
  return (
    <section id="nosotros" className="texture-dots overflow-hidden py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeading
          kicker="Conócenos"
          title="Nuestra Historia"
          subtitle="Una familia, dos países, un mismo sabor"
        />

        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
          <Reveal>
            {/* Card de texto con borde lateral tricolor */}
            <div className="relative rounded-2xl bg-white p-8 shadow-card md:p-10">
              <div
                className="absolute inset-y-0 left-0 flex w-1.5 flex-col overflow-hidden rounded-l-2xl"
                aria-hidden="true"
              >
                <span className="flex-1 bg-brand-yellow" />
                <span className="flex-1 bg-brand-blue" />
                <span className="flex-1 bg-brand-red" />
              </div>

              {/* Comilla decorativa */}
              <span
                className="pointer-events-none absolute -top-2 right-6 font-display text-8xl text-brand-yellow/30 select-none"
                aria-hidden="true"
              >
                &ldquo;
              </span>

              <p className="text-base leading-relaxed text-ink/80 md:text-lg">
                Somos una <strong className="text-brand-blue">familia venezolana</strong>{" "}
                que encontró en Ocucaje un nuevo hogar. Trajimos con nosotros el
                sabor de los llanos y lo unimos al cariño del Perú que nos recibió
                con los brazos abiertos.
              </p>
              <p className="mt-4 text-base leading-relaxed text-ink/80 md:text-lg">
                Cada pizza la preparamos de forma{" "}
                <strong className="text-brand-red">100% artesanal</strong>: masa
                hecha a mano, ingredientes frescos y recetas que mezclan lo mejor
                de dos tierras. De nuestro horno a tu mesa, con el mismo amor con
                el que cocinamos para nuestra propia familia.
              </p>
              <p className="mt-7 font-display text-2xl tracking-wide text-brand-blue md:text-3xl">
                ¡Gracias por ser parte de esta historia!
              </p>

              {/* Firma de marca */}
              <div className="mt-6 flex items-center gap-3 border-t border-ink/8 pt-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue font-display text-lg text-brand-yellow">
                  SL
                </span>
                <div className="text-sm">
                  <p className="font-semibold text-ink">Familia Sabor Llanero</p>
                  <p className="text-ink/55">Venezuela &rarr; Ocucaje, Perú</p>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={150}>
            {/* Video vertical real del local, con marco tricolor */}
            <div className="relative mx-auto w-full max-w-[18rem] sm:max-w-[20rem]">
              <div
                className="absolute -inset-3 rotate-2 rounded-[2rem] bg-gradient-to-br from-brand-yellow via-brand-blue to-brand-red opacity-80"
                aria-hidden="true"
              />
              <video
                className="relative aspect-[9/16] w-full rounded-[1.75rem] object-cover shadow-card-hover"
                src={siteConfig.media.localVideo}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="Recorrido en video por el local de Pizzería Sabor Llanero en Ocucaje"
              />
              {/* Badge flotante */}
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-brand-red px-5 py-2 font-display text-lg tracking-wide whitespace-nowrap text-white shadow-glow-red">
                Nuestro local
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
