import { formatPrice as sharedFormatPrice } from '@sabor/shared';
import { API_BASE_URL } from './env';

/** Precio en soles (S/), mismo formateador que usa la API/landing (packages/shared). */
export const formatPrice = sharedFormatPrice;

/** Fecha/hora de D1 (UTC "YYYY-MM-DD HH:MM:SS") en el formato local del navegador. */
export function formatDateTime(sqliteUtc: string): string {
  const date = new Date(`${sqliteUtc.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return sqliteUtc;
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

/**
 * Arma la URL pública de una media a partir de su clave R2. A diferencia de
 * Jaw (que sirve R2 directo desde un dominio pub-*.r2.dev), esta API expone
 * las claves bajo GET /api/media/:key — no hace falta un VITE_MEDIA_BASE_URL
 * aparte.
 */
export function mediaUrl(r2Key: string): string {
  return `${API_BASE_URL}/api/media/${r2Key}`;
}
