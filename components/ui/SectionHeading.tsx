import Reveal from "@/components/ui/Reveal";

interface SectionHeadingProps {
  /** Texto pequeño superior (eyebrow), ej. "Conócenos" */
  kicker?: string;
  title: string;
  subtitle?: string;
  /** Para secciones con fondo oscuro */
  light?: boolean;
  align?: "center" | "left";
}

/**
 * Título de sección: kicker en mayúsculas, Bangers grande y
 * subrayado tricolor de marca. Cada elemento entra animado
 * en cascada al hacer scroll (Reveal).
 */
export default function SectionHeading({
  kicker,
  title,
  subtitle,
  light = false,
  align = "center",
}: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <div className={`mb-14 max-w-2xl md:mb-20 ${centered ? "mx-auto text-center" : "text-left"}`}>
      {kicker && (
        <Reveal>
          <span
            className={`mb-3 inline-block rounded-full px-4 py-1 text-xs font-semibold tracking-[0.2em] uppercase ${
              light
                ? "bg-brand-yellow/15 text-brand-yellow"
                : "bg-brand-blue/8 text-brand-blue"
            }`}
          >
            {kicker}
          </span>
        </Reveal>
      )}
      <Reveal delay={90}>
        <h2
          className={`font-display text-4xl tracking-wide text-balance sm:text-5xl md:text-6xl ${
            light ? "text-white" : "text-ink"
          }`}
        >
          {title}
        </h2>
      </Reveal>
      {/* Subrayado tricolor de marca */}
      <Reveal delay={180}>
        <div
          className={`mt-4 flex h-1.5 w-28 overflow-hidden rounded-full ${centered ? "mx-auto" : ""}`}
          aria-hidden="true"
        >
          <span className="flex-1 bg-brand-yellow" />
          <span className={`flex-1 ${light ? "bg-white" : "bg-brand-blue"}`} />
          <span className="flex-1 bg-brand-red" />
        </div>
      </Reveal>
      {subtitle && (
        <Reveal delay={260}>
          <p className={`mt-5 text-base md:text-lg ${light ? "text-white/75" : "text-ink/65"}`}>
            {subtitle}
          </p>
        </Reveal>
      )}
    </div>
  );
}
