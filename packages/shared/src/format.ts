/**
 * Formateo de precios en soles peruanos (BLUEPRINT §7.4: moneda PEN, ej.
 * "S/ 25.00"). Usa `Intl.NumberFormat` cuando el runtime lo soporta
 * (Workers y navegadores modernos lo traen); si no, cae a un formateador
 * simple para no romper el render.
 */
const intlFormatter = createIntlFormatter();

export function formatPrice(amount: number): string {
  if (intlFormatter) return intlFormatter.format(amount);
  return `S/ ${amount.toFixed(2)}`;
}

function createIntlFormatter(): Intl.NumberFormat | null {
  try {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
  } catch {
    return null;
  }
}
