/*
 * Clases compartidas por todo lo que flota (Select, Popover, DropdownMenu,
 * Tooltip, Combobox). Un solo lugar para que el look sea consistente.
 */

/** Panel flotante: borde grueso de marca, animación de entrada/salida (sin animar con reduced-motion). */
export const popupClassName =
  'z-[60] rounded-xl border-2 border-border bg-popover text-popover-foreground shadow-glow outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 motion-reduce:animate-none';

/** Fila de lista/menú: objetivo táctil de 44 px, resaltado por teclado o puntero. */
export const optionClassName =
  'relative flex min-h-11 w-full cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm text-text outline-none data-[highlighted]:bg-lime-soft data-[highlighted]:text-forest data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[state=checked]:font-bold';

/** Etiqueta pequeña de sección dentro de un panel. */
export const popupLabelClassName =
  'px-3 py-1.5 text-xs font-bold font-display uppercase tracking-wide text-text-muted';
