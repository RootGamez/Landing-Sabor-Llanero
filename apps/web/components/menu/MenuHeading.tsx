import type { ReactNode } from "react";

interface MenuHeadingProps {
  /** Icono decorativo del set de components/ui/icons. */
  icon?: ReactNode;
  title: string;
  /** Para encabezados sobre fondo oscuro (bloque de promos). */
  light?: boolean;
}

/**
 * Encabezado h3 de subsecciones del catálogo (colecciones y categorías).
 * Versión compacta del lenguaje de SectionHeading (Bangers + acento
 * tricolor) — no se reusa SectionHeading porque ese siempre emite un h2 y
 * la jerarquía SEO de la sección exige h3 bajo el h2 "Nuestra Carta".
 */
export default function MenuHeading({ icon, title, light = false }: MenuHeadingProps) {
  return (
    <div className="mb-5 flex items-center gap-3 md:mb-6">
      {icon && (
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            light ? "bg-brand-yellow text-ink" : "bg-brand-blue/8 text-brand-blue"
          }`}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <div>
        <h3 className={`font-display text-2xl tracking-wide md:text-3xl ${light ? "text-white" : "text-ink"}`}>
          {title}
        </h3>
        <div className="mt-1 flex h-1 w-16 overflow-hidden rounded-full" aria-hidden="true">
          <span className="flex-1 bg-brand-yellow" />
          <span className={`flex-1 ${light ? "bg-white" : "bg-brand-blue"}`} />
          <span className="flex-1 bg-brand-red" />
        </div>
      </div>
    </div>
  );
}
