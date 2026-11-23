/** Exportar el reporte (o una gráfica) como imagen PNG nítida, con fondo sólido y tema claro. */
import { toBlob } from 'html-to-image';
import { downloadBlob } from './closureShare';
import { slugify } from './slug';

/** 2x: nítido en pantallas retina y al compartir por WhatsApp. */
const PIXEL_RATIO = 2;
/** Crema de marca, sólido (nunca transparente): el PNG se ve igual en cualquier visor. */
const EXPORT_BACKGROUND = '#fdf8ef';
/** Un PNG en blanco pesa muy poco: señal de la primera captura fallida de Safari. */
const MIN_VALID_PNG_BYTES = 8_000;

/** Atributo que marca lo que no debe salir en la imagen (botones, controles). */
export const EXPORT_IGNORE_ATTR = 'data-export-ignore';

const isExportable = (node: Node): boolean => !(node instanceof HTMLElement && node.hasAttribute(EXPORT_IGNORE_ATTR));

async function waitForAssets(node: HTMLElement): Promise<void> {
  if (document.fonts) await document.fonts.ready;
  const images = Array.from(node.querySelectorAll('img'));
  await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
}

const capture = (node: HTMLElement): Promise<Blob | null> =>
  toBlob(node, { pixelRatio: PIXEL_RATIO, backgroundColor: EXPORT_BACKGROUND, filter: isExportable, cacheBust: true });

/** Captura un nodo del DOM como PNG (reintenta una vez si la primera captura sale en blanco, típico de Safari). */
export async function renderNodePng(node: HTMLElement): Promise<Blob> {
  await waitForAssets(node);
  let blob = await capture(node);
  if (!blob || blob.size < MIN_VALID_PNG_BYTES) blob = await capture(node);
  if (!blob) throw new Error('No se pudo generar la imagen');
  return blob;
}

/** Nombre de archivo: "reporte-sabor-llanero-ingresos-y-egresos-2026-11-01_2026-11-23.png". */
export function exportFileName(title: string, range: { from: string; to: string }): string {
  return `reporte-sabor-llanero-${slugify(title)}-${range.from}_${range.to}.png`;
}

export async function downloadNodePng(node: HTMLElement, fileName: string): Promise<void> {
  downloadBlob(await renderNodePng(node), fileName);
}
