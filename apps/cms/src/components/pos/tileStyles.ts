/**
 * Estilos compartidos por todas las celdas de la cuadrícula del POS (categorías, productos y "Volver").
 *
 * Dos disposiciones, según el interruptor "Mostrar fotos":
 * - compacta (sin fotos): celdas cuadradas en 2/3/4 columnas, la más densa.
 * - con fotos: filas con la miniatura a la izquierda y el texto a la derecha (1 columna en móvil,
 *   2-3-4 más arriba). La foto nunca roba ancho al nombre ni al precio y cada fila mide ≥ 80 px (foto de 64 px).
 */
const TILE_INTERACTION_CLASS =
  'relative w-full min-w-0 rounded-xl border-2 text-left text-text outline-none select-none touch-manipulation ' +
  'transition-[transform,filter,box-shadow] duration-150 hover:brightness-95 active:scale-[0.97] active:brightness-90 ' +
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
  'motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100';

const COMPACT_LAYOUT_CLASS = 'flex h-full min-h-28 flex-col justify-between gap-2 p-3';
const ROW_LAYOUT_CLASS = 'flex h-full min-h-20 items-center gap-3 p-1.5';

const COMPACT_GRID_CLASS = 'grid grid-cols-2 gap-3 pb-2 sm:grid-cols-3 xl:grid-cols-4';
const ROW_GRID_CLASS = 'grid grid-cols-1 gap-2 pb-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3 min-[1600px]:grid-cols-4';

/** Color del texto secundario sobre los fondos pastel: `text-text-muted` no llega a 4,5:1 (3,9-4,5), este sí (>= 5,2). */
export const TILE_SECONDARY_TEXT_CLASS = 'text-text/80';

export function tileGridClass(showPhotos: boolean): string {
  return showPhotos ? ROW_GRID_CLASS : COMPACT_GRID_CLASS;
}

export function tileClass(showPhotos: boolean): string {
  return `${showPhotos ? ROW_LAYOUT_CLASS : COMPACT_LAYOUT_CLASS} ${TILE_INTERACTION_CLASS}`;
}

/** Disposición compacta (sin fotos): la usan también los selectores de sabores. */
export const TILE_GRID_CLASS = COMPACT_GRID_CLASS;
export const TILE_BASE_CLASS = tileClass(false);
