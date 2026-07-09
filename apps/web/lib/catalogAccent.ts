/**
 * Color de acento del borde 3D de cada card. Rota sobre el tricolor de marca
 * para que el grid se vea vivo sin inventar colores fuera del sistema; los
 * ítems destacados quedan siempre en amarillo, a juego con su badge.
 *
 * Se entrega como custom properties (no como clases de Tailwind) porque el
 * color es dinámico por ítem y las clases armadas en runtime no sobreviven al
 * purgado del build.
 */
import type { CSSProperties } from "react";

interface CardAccent {
  /** Borde y detalles del acento. */
  accent: string;
  /** Cara inferior del relieve 3D: la variante oscura del mismo color. */
  accentDeep: string;
}

const YELLOW: CardAccent = {
  accent: "var(--color-brand-yellow)",
  accentDeep: "var(--color-brand-yellow-deep)",
};

const ACCENT_CYCLE: readonly CardAccent[] = [
  YELLOW,
  { accent: "var(--color-brand-blue)", accentDeep: "var(--color-brand-blue-deep)" },
  { accent: "var(--color-brand-red)", accentDeep: "var(--color-brand-red-deep)" },
];

export function accentFor(item: { id: number; isFeatured: boolean }): CardAccent {
  if (item.isFeatured) return YELLOW;
  // El `?? YELLOW` es inalcanzable (el módulo acota el índice); está solo para
  // satisfacer `noUncheckedIndexedAccess`.
  return ACCENT_CYCLE[item.id % ACCENT_CYCLE.length] ?? YELLOW;
}

/** Style inline listo para el contenedor de la card (lo consume `.card-3d`). */
export function accentStyle(item: { id: number; isFeatured: boolean }): CSSProperties {
  const { accent, accentDeep } = accentFor(item);
  return { "--accent": accent, "--accent-deep": accentDeep } as CSSProperties;
}
