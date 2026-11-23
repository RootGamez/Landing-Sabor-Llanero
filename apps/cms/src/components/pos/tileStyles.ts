/** Estilos compartidos por todas las celdas de la cuadrícula del POS (categorías, productos y "Volver"): mismo tamaño. */
export const TILE_GRID_CLASS = 'grid grid-cols-2 gap-3 pb-2 sm:grid-cols-3 xl:grid-cols-4';

export const TILE_BASE_CLASS =
  'relative flex h-full min-h-28 w-full min-w-0 flex-col justify-between gap-2 rounded-xl border-2 p-3 text-left text-text outline-none select-none touch-manipulation ' +
  'transition-[transform,filter,box-shadow] duration-150 hover:brightness-95 active:scale-[0.97] active:brightness-90 ' +
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
  'motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100';
