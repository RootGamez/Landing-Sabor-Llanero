/** Margen neto en %, con un decimal: ganancia / ingresos. null si no hubo ingresos (no hay base). */
export function marginPct(profitCents: number, incomeCents: number): number | null {
  if (incomeCents <= 0) return null;
  return Math.round((profitCents / incomeCents) * 1000) / 10;
}
