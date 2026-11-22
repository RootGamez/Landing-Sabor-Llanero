/**
 * Colores de categoría del POS, derivados de la paleta de marca. Todos son
 * fondos claros con texto `text-text` (azul de marca): contraste > 7:1. El color
 * ayuda a ubicarse rápido pero nunca es la única pista (siempre hay nombre).
 */
export interface CategoryTone {
  /** Fondo + borde del botón de producto. */
  card: string;
  /** Punto/indicador de la categoría en los chips. */
  dot: string;
}

const FALLBACK_TONE: CategoryTone = { card: 'bg-surface-2 border-border', dot: 'bg-text-muted' };

const TONES: readonly CategoryTone[] = [
  { card: 'bg-lime-soft border-lime-strong', dot: 'bg-lime-strong' },
  { card: 'bg-sky-soft border-sky-strong', dot: 'bg-sky-strong' },
  { card: 'bg-[#dde6fb] border-forest-line', dot: 'bg-forest-line' },
  { card: 'bg-[#dcefe2] border-success', dot: 'bg-success' },
  { card: 'bg-[#fde8d3] border-[#c46a14]', dot: 'bg-[#c46a14]' },
  { card: 'bg-surface-2 border-border', dot: 'bg-text-muted' },
];

export function toneFor(colorIndex: number): CategoryTone {
  return TONES[colorIndex % TONES.length] ?? FALLBACK_TONE;
}
