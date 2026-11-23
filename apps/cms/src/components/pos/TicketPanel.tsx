import { useEffect, useId, useState, type ReactNode } from 'react';
import { Minus, Plus, ReceiptText, Trash2 } from 'lucide-react';
import { formatPEN } from '@sabor/shared';
import { cartCount, cartSubtotal, cartTotal, centsToInputText, lineTotal, parseSolesToCents, type CartLine } from '../../lib/posCart';
import { cn } from '../../lib/utils';
import { useCart, useCartApi } from '../../store/posCartContext';
import { Button } from '../ui/Button';
import { TicketLineExtras } from './TicketLineExtras';

const STEP_BUTTON =
  'inline-flex size-11 items-center justify-center rounded-full border-2 border-border bg-surface text-text outline-none transition-colors hover:border-forest-line focus-visible:ring-2 focus-visible:ring-ring active:bg-muted disabled:opacity-40';

interface TicketPanelProps {
  canDiscount: boolean;
  onCharge: () => void;
  className?: string;
  /** Encabezado (por defecto "Ticket"; en una mesa, "Mesa 3"). */
  title?: string;
  /**
   * Cuenta de mesa: cantidades ya guardadas por línea. Lo que supera lo guardado se
   * marca como nuevo; sin `canReduceSaved` no se puede bajar de lo guardado.
   */
  savedQuantities?: ReadonlyMap<string, number>;
  canReduceSaved?: boolean;
  /** Reemplaza el botón "Cobrar" (la mesa muestra "Guardar pedido" / "Cerrar mesa"). */
  footerActions?: ReactNode;
  /** Muestra "Vaciar" (por defecto sí; la cuenta de una mesa no se vacía así). */
  allowClear?: boolean;
}

/** Unidades nuevas de la línea desde el último guardado y el mínimo al que se puede bajar. */
function lineSavedState(line: CartLine, saved: ReadonlyMap<string, number> | undefined, canReduceSaved: boolean) {
  const savedQty = saved?.get(line.key) ?? 0;
  return {
    newUnits: saved ? Math.max(line.quantity - savedQty, 0) : 0,
    isNewLine: saved !== undefined && savedQty === 0,
    minQuantity: canReduceSaved ? 0 : savedQty,
  };
}

/** Solo admite montos bien formados ("5", "2.50", "2,5"): no hay estado inválido que dejar a medias. */
const DISCOUNT_INPUT_RE = /^\d{0,7}(?:[.,]\d{0,2})?$/;

function DiscountField({ subtotalCents }: { subtotalCents: number }) {
  const fieldId = useId();
  const discountCents = useCart((s) => s.discountCents);
  const setDiscount = useCart((s) => s.setDiscount);
  const [text, setText] = useState(() => (discountCents > 0 ? centsToInputText(discountCents) : ''));

  // El store recorta el descuento (p. ej. al quitar líneas): el texto debe reflejarlo.
  useEffect(() => {
    const typed = text.trim() === '' ? 0 : parseSolesToCents(text);
    if (typed !== discountCents) setText(discountCents > 0 ? centsToInputText(discountCents) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe reaccionar al valor del store, no a cada tecla.
  }, [discountCents]);

  function handleChange(value: string) {
    if (!DISCOUNT_INPUT_RE.test(value)) return;
    setText(value);
    const cents = value.trim() === '' ? 0 : parseSolesToCents(value);
    if (cents !== null) setDiscount(cents);
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">
        Descuento (S/)
      </label>
      <input
        id={fieldId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={(event) => event.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
        placeholder="0"
        aria-describedby={`${fieldId}-hint`}
        className="h-11 w-full rounded-xl border-2 border-border bg-surface px-3 text-base tabular-nums text-text outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
      <p id={`${fieldId}-hint`} className="text-xs text-text-muted">
        Máximo {formatPEN(subtotalCents)}
      </p>
    </div>
  );
}

function ClearButton({ onClear }: { onClear: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-destructive outline-none hover:bg-sky-soft focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Trash2 className="size-4" aria-hidden="true" />
        Vaciar
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1" role="group" aria-label="Confirmar vaciar el ticket">
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          onClear();
        }}
        className="min-h-11 rounded-full bg-destructive px-3 text-sm font-bold text-destructive-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Sí, vaciar
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-11 rounded-full px-3 text-sm font-bold text-text outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        No
      </button>
    </span>
  );
}

export function TicketPanel({
  canDiscount,
  onCharge,
  className,
  title = 'Ticket',
  savedQuantities,
  canReduceSaved = true,
  footerActions,
  allowClear = true,
}: TicketPanelProps) {
  const titleId = useId();
  const lines = useCart((s) => s.lines);
  const discountCents = useCart((s) => s.discountCents);
  const { increment, decrement, remove, clear } = useCartApi().getState();
  const subtotal = cartSubtotal(lines);
  const total = cartTotal(lines, discountCents);
  const isEmpty = lines.length === 0;

  return (
    <section
      aria-labelledby={titleId}
      className={cn('flex min-h-0 flex-col rounded-xl2 border-2 border-border bg-card', className)}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <h2 id={titleId} className="font-display text-base font-bold text-text">
          {title} <span className="font-medium text-text-muted">({cartCount(lines)})</span>
        </h2>
        {allowClear && !isEmpty && <ClearButton onClear={clear} />}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
        {isEmpty ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-text-muted">
            <ReceiptText className="size-8" aria-hidden="true" />
            <p className="text-sm font-medium">El ticket está vacío</p>
            <p className="text-xs">Toca un producto para agregarlo.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {lines.map((line) => {
              const { newUnits, isNewLine, minQuantity } = lineSavedState(line, savedQuantities, canReduceSaved);
              return (
                <li key={line.key} className="flex flex-col gap-1.5 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 break-words text-sm font-bold leading-tight text-text">
                        {line.name}
                        {newUnits > 0 && (
                          <span className="ml-1.5 inline-flex rounded-full border border-forest bg-accent px-1.5 align-middle text-[11px] font-bold uppercase text-accent-foreground">
                            {isNewLine ? 'Nuevo' : `+${newUnits} nuevo`}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-text-muted">
                        {line.sizeLabel ? `${line.sizeLabel} · ` : ''}
                        {formatPEN(line.unitPriceCents)}
                      </p>
                    </div>
                    <span className="shrink-0 text-base font-extrabold tabular-nums text-text">
                      {formatPEN(lineTotal(line))}
                    </span>
                  </div>
                  <TicketLineExtras line={line} locked={minQuantity > 0} />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={STEP_BUTTON}
                        disabled={minQuantity > 0 && line.quantity <= minQuantity}
                        onClick={() => decrement(line.key)}
                        aria-label={`Quitar una unidad de ${line.name}${line.sizeLabel ? ` ${line.sizeLabel}` : ''}`}
                      >
                        <Minus className="size-4" aria-hidden="true" />
                      </button>
                      <span className="min-w-8 text-center text-lg font-bold tabular-nums">{line.quantity}</span>
                      <button
                        type="button"
                        className={STEP_BUTTON}
                        onClick={() => increment(line.key)}
                        aria-label={`Agregar una unidad de ${line.name}${line.sizeLabel ? ` ${line.sizeLabel}` : ''}`}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="inline-flex size-11 items-center justify-center rounded-full text-text-muted outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                      disabled={minQuantity > 0}
                      onClick={() => remove(line.key)}
                      aria-label={`Quitar ${line.name}${line.sizeLabel ? ` ${line.sizeLabel}` : ''} del ticket`}
                    >
                      <Trash2 className="size-5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="flex flex-col gap-3 border-t-2 border-border px-4 py-3">
        {canDiscount && !isEmpty && <DiscountField subtotalCents={subtotal} />}
        {discountCents > 0 && (
          <p className="flex justify-between text-sm text-text-muted tabular-nums">
            <span>Subtotal {formatPEN(subtotal)}</span>
            <span>Descuento −{formatPEN(discountCents)}</span>
          </p>
        )}
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="flex items-baseline justify-between gap-2 text-text"
        >
          <span className="font-display text-sm font-bold uppercase tracking-wide">Total</span>
          <span className="text-4xl font-extrabold tabular-nums">{formatPEN(total)}</span>
        </p>
        {footerActions ?? (
          <Button size="lg" className="h-16 w-full text-lg" disabled={isEmpty || total <= 0} onClick={onCharge}>
            Cobrar
            <kbd className="ml-1 hidden rounded border border-current/40 px-1.5 text-xs font-medium normal-case lg:inline">
              Enter
            </kbd>
          </Button>
        )}
      </footer>
    </section>
  );
}
