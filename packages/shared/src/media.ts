/**
 * Reglas de subida de media (tabla `item_media`, BLUEPRINT §4.1). Copiado de
 * media.ts en Jaw cambiando el prefijo de `products/` a `items/`. Fuente
 * única compartida: la API las aplica al recibir el archivo y el CMS puede
 * reusarlas para validar en el formulario antes de subir, evitando viajes
 * de ida y vuelta con archivos inválidos.
 */
import type { MediaType } from './types';

/**
 * Tamaño máximo por archivo. Acota el uso de memoria del Worker (que carga
 * el archivo completo al subirlo a R2) y el costo de almacenamiento.
 */
export const MEDIA_MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * MIME permitidos y su extensión canónica. La extensión se deriva de acá y
 * NUNCA del nombre de archivo del cliente. SVG queda excluido a propósito:
 * al servirse desde el mismo origen puede ejecutar scripts (XSS almacenado).
 */
export const ALLOWED_MEDIA_MIME: Record<string, { type: MediaType; ext: string }> = {
  'image/jpeg': { type: 'image', ext: 'jpg' },
  'image/png': { type: 'image', ext: 'png' },
  'image/webp': { type: 'image', ext: 'webp' },
  'image/gif': { type: 'image', ext: 'gif' },
  'video/mp4': { type: 'video', ext: 'mp4' },
  'video/webm': { type: 'video', ext: 'webm' },
};

/** Prefijo bajo el cual viven las claves de media de ítems en R2. */
export const MEDIA_KEY_PREFIX = 'items/';

/** Prefijo bajo el cual viven los banners de categoría en R2. */
export const CATEGORY_MEDIA_KEY_PREFIX = 'categories/';

/**
 * Prefijos R2 servibles públicamente. El endpoint público de media solo
 * entrega objetos bajo estos prefijos, nunca claves arbitrarias del bucket.
 */
export const PUBLIC_MEDIA_PREFIXES = [MEDIA_KEY_PREFIX, CATEGORY_MEDIA_KEY_PREFIX] as const;

/** Límite en MB para mensajes de error legibles. */
export const MEDIA_MAX_UPLOAD_MB = Math.floor(MEDIA_MAX_UPLOAD_BYTES / (1024 * 1024));
