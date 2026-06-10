import Image from "next/image";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";

/**
 * Sección Nosotros: historia breve y emotiva del negocio familiar.
 * El texto es placeholder editable — cámbialo libremente.
 */
export default function About() {
  return (
    <section id="nosotros" className="bg-surface py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeading
          title="Nuestra Historia"
          subtitle="Una familia, dos países, un mismo sabor"
        />

        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
          <Reveal>
            {/* Acento tricolor: borde lateral del bloque de texto */}
            <div className="relative rounded-2xl bg-white p-8 shadow-sm md:p-10">
              <div className="absolute inset-y-0 left-0 flex w-1.5 flex-col overflow-hidden rounded-l-2xl" aria-hidden="true">
                <span className="flex-1 bg-brand-yellow" />
                <span className="flex-1 bg-brand-blue" />
                <span className="flex-1 bg-brand-red" />
              </div>
              <p className="text-base leading-relaxed text-ink/80 md:text-lg">
                Somos una <strong className="text-brand-blue">familia venezolana</strong> que
                encontró en Ocucaje un nuevo hogar. Trajimos con nosotros el sabor de
                los llanos y lo unimos al cariño del Perú que nos recibió con los
                brazos abiertos.
              </p>
              <p className="mt-4 text-base leading-relaxed text-ink/80 md:text-lg">
                Cada pizza la preparamos de forma <strong className="text-brand-red">100% artesanal</strong>:
                masa hecha a mano, ingredientes frescos y recetas que mezclan lo mejor
                de dos tierras. De nuestro horno a tu mesa, con el mismo amor con el
                que cocinamos para nuestra propia familia.
              </p>
              <p className="mt-6 font-display text-2xl tracking-wide text-brand-blue">
                ¡Gracias por ser parte de esta historia! 🇻🇪🤝🇵🇪
              </p>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-lg">
              <Image
                src="/images/about/family.jpg"
                alt="La familia detrás de Pizzería Sabor Llanero en su local de Ocucaje"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
