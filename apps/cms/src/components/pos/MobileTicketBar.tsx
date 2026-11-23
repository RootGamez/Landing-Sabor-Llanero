import { ReceiptText } from 'lucide-react';
import { formatPEN } from '@sabor/shared';
import { cartCount, cartTotal } from '../../lib/posCart';
import { useCart } from '../../store/posCartContext';
import { Button } from '../ui/Button';

interface MobileTicketBarProps {
  onOpenTicket: () => void;
  onCharge: () => void;
  /** Texto de la acción principal (por defecto "Cobrar"; en una mesa, "Guardar pedido"). */
  actionLabel?: string;
  /** Deshabilita la acción principal además de la regla "ticket vacío". */
  actionDisabled?: boolean;
  /** Título del resumen (por defecto "Ver ticket"). */
  summaryLabel?: string;
}

/** Barra inferior (<lg): resumen del ticket, acceso a su detalle y "Cobrar" siempre a mano. */
export function MobileTicketBar({
  onOpenTicket,
  onCharge,
  actionLabel = 'Cobrar',
  actionDisabled = false,
  summaryLabel = 'Ver ticket',
}: MobileTicketBarProps) {
  const lines = useCart((s) => s.lines);
  const discountCents = useCart((s) => s.discountCents);
  const total = cartTotal(lines, discountCents);
  const count = cartCount(lines);

  return (
    <div className="flex shrink-0 items-center gap-2 rounded-xl2 border-2 border-forest bg-card p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-sticker lg:hidden">
      <button
        type="button"
        onClick={onOpenTicket}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ReceiptText className="size-6 shrink-0" aria-hidden="true" />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-xs font-bold uppercase tracking-wide text-text-muted">
            {summaryLabel} · {count} {count === 1 ? 'producto' : 'productos'}
          </span>
          <span aria-live="polite" aria-atomic="true" className="text-2xl font-extrabold tabular-nums">
            {formatPEN(total)}
          </span>
        </span>
      </button>
      <Button size="lg" className="h-14 shrink-0 px-6 sm:px-8" disabled={actionDisabled || count === 0 || total <= 0} onClick={onCharge}>
        {actionLabel}
      </Button>
    </div>
  );
}
