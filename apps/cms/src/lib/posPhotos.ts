/**
 * Fotos del POS: URLs reducidas y preferencia "Mostrar fotos". Funciones puras
 * (sin `import.meta.env` ni `window`) para poder probarlas con `tsx --test`.
 *
 * Las fotos originales pesan 0,1-3 MB (se suben tal cual desde el celular). En
 * producción Cloudflare Image Transformations las sirve recortadas a un cuadrado
 * de 160 px en ~5-10 KB vía `/cdn-cgi/image/<opciones>/<url-origen>` (misma zona
 * que la API, así que también aplica desde el host del CMS). Fuera de esa zona
 * (localhost, workers.dev) se devuelve la URL original: nunca se rompe una foto.
 */

/** Anchos (px) del cuadrado de la miniatura de 64 px de pantalla: 160 cubre 1x-2x (y 2,5x), 240 cubre 3x+. */
export const PHOTO_WIDTHS = [160, 240] as const;
const PHOTO_QUALITY = 75;

export interface PhotoEnv {
  /** Base de la API (`https://api.saborllanero.online`): de ahí salen las fotos. */
  apiBaseUrl: string;
  /** `window.location.hostname` del CMS. */
  pageHostname: string;
}

/** Zona (últimos dos rótulos) de un host: `cms.saborllanero.online` -> `saborllanero.online`. */
function zoneOf(hostname: string): string {
  return hostname.split('.').slice(-2).join('.');
}

/** ¿El CMS y la API comparten zona de Cloudflare (y la API es https)? Solo entonces existe `/cdn-cgi/image`. */
export function canResizePhotos({ apiBaseUrl, pageHostname }: PhotoEnv): boolean {
  if (!apiBaseUrl.startsWith('https://')) return false;
  const apiHostname = new URL(apiBaseUrl).hostname;
  return apiHostname.includes('.') && zoneOf(apiHostname) === zoneOf(pageHostname);
}

/** URL de la foto original en la API (cada tramo de la clave se codifica para no romper la ruta de `/cdn-cgi/image`). */
export function photoOriginalUrl(key: string, env: PhotoEnv): string {
  return `${env.apiBaseUrl}/api/media/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/** URL de la miniatura cuadrada de `size` px (la original si no hay transformaciones). */
export function photoSrc(key: string, size: number, env: PhotoEnv): string {
  const original = photoOriginalUrl(key, env);
  if (!canResizePhotos(env)) return original;
  const options = `width=${size},height=${size},fit=cover,gravity=auto,quality=${PHOTO_QUALITY},format=auto,onerror=redirect`;
  return `/cdn-cgi/image/${options}/${original}`;
}

/** `srcset` por ancho; `undefined` si no hay transformaciones (se usa solo `src`). */
export function photoSrcSet(key: string, env: PhotoEnv): string | undefined {
  if (!canResizePhotos(env)) return undefined;
  return PHOTO_WIDTHS.map((width) => `${photoSrc(key, width, env)} ${width}w`).join(', ');
}

export const SHOW_PHOTOS_STORAGE_KEY = 'sabor-pos-show-photos';

/** Pistas de la conexión (`navigator.connection`): ahorro de datos o 2G. */
export interface ConnectionHint {
  saveData?: boolean;
  effectiveType?: string;
}

export function isSlowConnection(connection: ConnectionHint | undefined): boolean {
  if (!connection) return false;
  return connection.saveData === true || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';
}

/**
 * Preferencia guardada ("1"/"0"); sin valor guardado (o si el almacenamiento falla)
 * las fotos van encendidas salvo que la conexión sea lenta o pida ahorrar datos.
 */
export function readShowPhotos(storage: Pick<Storage, 'getItem'> | null, connection?: ConnectionHint): boolean {
  try {
    const stored = storage?.getItem(SHOW_PHOTOS_STORAGE_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch {
    // Almacenamiento bloqueado (modo privado): se usa el valor por defecto.
  }
  return !isSlowConnection(connection);
}

/** Guarda la preferencia; si el almacenamiento falla, la sesión actual sigue funcionando sin persistir. */
export function writeShowPhotos(storage: Pick<Storage, 'setItem'> | null, value: boolean): void {
  try {
    storage?.setItem(SHOW_PHOTOS_STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Sin persistencia: no es un error para el cajero.
  }
}
