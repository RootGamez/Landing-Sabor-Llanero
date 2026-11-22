/** Imagen PNG del cierre en el cliente y su entrega (compartir, descargar, copiar). */
import { toBlob } from 'html-to-image';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
const PIXEL_RATIO = 2;
const CARD_BACKGROUND = '#fdf8ef';
const REVOKE_DELAY_MS = 60_000;
/** Un PNG en blanco pesa muy poco: señal de la primera captura fallida de Safari. */
const MIN_VALID_PNG_BYTES = 20_000;

/** Espera fuentes y cualquier imagen de la tarjeta antes de capturarla. */
async function waitForAssets(node: HTMLElement): Promise<void> {
  if (document.fonts) await document.fonts.ready;
  const images = Array.from(node.querySelectorAll('img'));
  await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
}

function capture(node: HTMLElement): Promise<Blob | null> {
  return toBlob(node, {
    pixelRatio: PIXEL_RATIO,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: CARD_BACKGROUND,
  });
}

/** Safari/iOS suele devolver la primera captura en blanco: si pesa muy poco se repite una vez. */
export async function renderPngBlob(node: HTMLElement): Promise<Blob> {
  await waitForAssets(node);
  let blob = await capture(node);
  if (!blob || blob.size < MIN_VALID_PNG_BYTES) blob = await capture(node);
  if (!blob) throw new Error('No se pudo generar la imagen del cierre');
  return blob;
}

export function toPngFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: 'image/png' });
}

/** `true` si el navegador puede compartir este archivo (Web Share API nivel 2: móviles y algunos escritorios). */
export function canShareFile(file: File): boolean {
  return typeof navigator.canShare === 'function' && typeof navigator.share === 'function' && navigator.canShare({ files: [file] });
}

/** Abre la hoja de compartir del sistema. Devuelve `false` si la persona la cerró sin compartir. */
export async function shareFile(file: File, title: string, text: string): Promise<boolean> {
  try {
    await navigator.share({ files: [file], title, text });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return false;
    throw error;
  }
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

export async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard) throw new Error('Tu navegador no permite copiar al portapapeles');
  await navigator.clipboard.writeText(text);
}
