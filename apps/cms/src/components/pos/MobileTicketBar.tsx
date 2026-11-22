import { ReceiptText } from 'lucide-react';
import { formatPEN } from '@sabor/shared';
import { cartCount, cartTotal } from '../../lib/posCart';
import { usePosCartStore } from '../../store/posCartStore';
import { Button } from '../ui/Button';

interface MobileTicketBarProps {
  onOpenTicket: () => void;
  onCharge: () => void;
}

/** Barra inferior (<lg): resumen del ticket, acceso a su detalle y "Cobrar" siempre a mano. */
export function MobileTicketBar({ onOpenTicket, onCharge }: MobileTicketBarProps) {
  const lines = usePosCartStore((s) => s.lines);
  const discountCents = usePosCartStore((s) => s.discountCents);
  const total = cartTotal(lines, discountCents);
  const count = cartCount(lines);

  return (
    <div className="flex shrink-0 items-center gap-2 rounded-xl2 border-2 border-forest bg-card p-2 lg:hidden">
      <button
        type="button"
        onClick={onOpenTicket}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ReceiptText className="size-6 shrink-0" aria-hidden="true" />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-xs font-bold uppercase tracking-wide text-text-muted">
            Ver ticket · {count} {count === 1 ? 'producto' : 'productos'}
          </span>
          <span aria-live="polite" aria-atomic="true" className="text-2xl font-extrabold tabular-nums">
            {formatPEN(total)}
          </span>
        </span>
      </button>
      <Button size="lg" className="h-14 shrink-0 px-8" disabled={count === 0 || total <= 0} onClick={onCharge}>
        Cobrar
      </Button>
    </div>
  );
}
