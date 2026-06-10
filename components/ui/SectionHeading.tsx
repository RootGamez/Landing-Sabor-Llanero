interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  /** Para secciones con fondo oscuro (azul) */
  light?: boolean;
}

/**
 * Título de sección en Bangers con subrayado tricolor.
 */
export default function SectionHeading({ title, subtitle, light = false }: SectionHeadingProps) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
      <h2
        className={`font-display text-4xl tracking-wide md:text-5xl ${
          light ? "text-white" : "text-ink"
        }`}
      >
        {title}
      </h2>
      {/* Subrayado tricolor de marca */}
      <div className="mx-auto mt-3 flex h-1.5 w-24 overflow-hidden rounded-full" aria-hidden="true">
        <span className="flex-1 bg-brand-yellow" />
        <span className="flex-1 bg-brand-blue" />
        <span className="flex-1 bg-brand-red" />
      </div>
      {subtitle && (
        <p className={`mt-4 text-base md:text-lg ${light ? "text-white/80" : "text-ink/70"}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
