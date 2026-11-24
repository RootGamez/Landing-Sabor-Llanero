"use client";

import Link from "next/link";
import { formatPrice } from "@sabor/shared";
import { MinusIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import type { CartLine, StaleReason } from "@/lib/cart";

interface CartLineRowProps {
  line: CartLine;
  onIncrement: (line: CartLine) => void;
  onDecrement: (line: CartLine) => void;
  onRemove: (line: CartLine) => void;
  /**
   * Carrito viejo: el ítem ahora se vende por presentación/tamaño y esta línea
   * no trae una válida. Se avisa y se enlaza a la carta para elegir de nuevo.
   */
  staleReason?: StaleReason;
}

const STALE_COPY: Record<StaleReason, { hint: string; action: string }> = {
  portion: {
    hint: "Ahora se vende por presentación (media docena, docena…).",
    action: "Elegir presentación",
  },
  size: { hint: "Ahora se vende por tamaño.", action: "Elegir tamaño" },
};

/**
 * Línea del carrito (P2.7): nombre + tamaño, stepper de cantidad y quitar.
 * Botones de 44px (mínimo táctil) — el manejo de foco al quitar una línea
 * vive en el padre (`CartPageContent`), que mueve el foco ANTES de que esta
 * fila se desmonte (mismo problema que P1.5/P2.5 ya resolvieron ahí).
 */
export default function CartLineRow({
  line,
  onIncrement,
  onDecrement,
  onRemove,
  staleReason,
}: CartLineRowProps) {
  // Dos presentaciones del mismo ítem son dos líneas: el nombre accesible las distingue.
  const fullName = line.sizeLabel ? `${line.name} (${line.sizeLabel})` : line.name;
  const stale = staleReason ? STALE_COPY[staleReason] : null;

  return (
    <li className="flex items-start justify-between gap-3 rounded-2xl border-2 border-ink/10 bg-white p-4">
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg tracking-wide text-ink">{line.name}</p>
        {line.sizeLabel && <p className="text-sm text-ink/60">{line.sizeLabel}</p>}
        <p className="mt-1 text-sm font-semibold text-brand-red tabular-nums">{formatPrice(line.unitPrice)}</p>
        {stale && (
          <p className="mt-2 text-sm text-ink/80">
            {stale.hint}{" "}
            <Link
              href={`/menu/#item-${line.itemSlug}`}
              className="inline-flex min-h-11 items-center font-semibold text-brand-blue underline hover:text-brand-red"
            >
              {stale.action}
              <span className="sr-only"> de {line.name}</span>
            </Link>
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onDecrement(line)}
            aria-label={
              line.quantity <= 1 ? `Quitar ${fullName} del carrito` : `Quitar una unidad de ${fullName}`
            }
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-ink/10 text-ink transition-colors duration-200 hover:border-brand-red/40 hover:text-brand-red active:scale-95"
          >
            <MinusIcon className="h-4 w-4" />
          </button>
          <span className="w-7 text-center text-sm font-bold tabular-nums text-ink" aria-live="polite">
            <span className="sr-only">Cantidad: </span>
            {line.quantity}
          </span>
          <button
            type="button"
            onClick={() => onIncrement(line)}
            aria-label={`Agregar una unidad más de ${fullName}`}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-ink/10 text-ink transition-colors duration-200 hover:border-brand-red/40 hover:text-brand-red active:scale-95"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <p className="text-sm font-bold tabular-nums text-ink">{formatPrice(line.unitPrice * line.quantity)}</p>
          <button
            type="button"
            onClick={() => onRemove(line)}
            aria-label={`Quitar ${fullName} del carrito`}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-ink/60 transition-colors duration-200 hover:bg-brand-red/10 hover:text-brand-red"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
