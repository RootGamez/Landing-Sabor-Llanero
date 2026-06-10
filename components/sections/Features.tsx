import Reveal from "@/components/ui/Reveal";
import { FlameIcon, HeartHandsIcon, WheatIcon } from "@/components/ui/icons";

const features = [
  {
    icon: WheatIcon,
    accent: "bg-brand-yellow text-ink",
    title: "Masa artesanal",
    text: "Fermentada y estirada a mano cada día. Sin atajos, como debe ser.",
  },
  {
    icon: FlameIcon,
    accent: "bg-brand-red text-white",
    title: "Recién horneada",
    text: "Del horno a tu mesa en su punto exacto: crocante afuera, suave adentro.",
  },
  {
    icon: HeartHandsIcon,
    accent: "bg-brand-blue text-white",
    title: "Sabor de dos tierras",
    text: "Recetas que unen los llanos de Venezuela con el cariño del Perú.",
  },
] as const;

/**
 * Franja de propuesta de valor: tres pilares de la marca
 * en cards elevadas que se superponen al hero.
 */
export default function Features() {
  return (
    <section aria-label="Por qué elegirnos" className="relative z-20 -mt-14 pb-4 md:-mt-16">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-3 md:gap-6 md:px-6">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 100}>
            <article className="group h-full rounded-2xl border border-ink/5 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover md:p-7">
              <span
                className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${f.accent} transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`}
              >
                <f.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-display text-2xl tracking-wide text-ink">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/65">{f.text}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
