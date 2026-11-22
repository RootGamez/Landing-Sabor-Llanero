import { useEffect, useRef, useState } from 'react';
import { formatPEN, type CashSessionDetail, type PendingWebOrder, type Sale } from '@sabor/shared';
import { usePaymentMethods, usePendingWebOrders, usePosCatalog } from '../../hooks/usePos';
import { usePosShortcuts } from '../../hooks/usePosShortcuts';
import { cartTotal, newClientUuid, toSaleItems } from '../../lib/posCart';
import { useSessionStore } from '../../store/sessionStore';
import { usePosCartStore } from '../../store/posCartStore';
import { toastSuccess } from '../../store/toastStore';
import { MobileTicketBar } from './MobileTicketBar';
import { PaymentDialog, type SalePayload } from './PaymentDialog';
import { PendingOrdersSheet } from './PendingOrdersSheet';
import { PosCatalogPanel } from './PosCatalogPanel';
import { PosModal } from './PosModal';
import { SessionBar } from './SessionBar';
import { SessionSalesSheet } from './SessionSalesSheet';
import { TicketPanel } from './TicketPanel';

/** Qué se está cobrando: el ticket actual o un pedido web confirmado. */
type Charge = { kind: 'cart' } | { kind: 'order'; order: PendingWebOrder; clientUuid: string };

type Overlay = 'ticket' | 'pending' | 'sales' | null;

interface PosWorkspaceProps {
  session: CashSessionDetail;
  /** Refresca la caja (totales del turno, o detecta que se cerró). */
  onSessionChanged: () => void;
}

function paidMessage(sale: Sale): string {
  const change = sale.changeCents ?? 0;
  return change > 0
    ? `Venta #${sale.number} registrada · Vuelto ${formatPEN(change)}`
    : `Venta #${sale.number} registrada`;
}

export function PosWorkspace({ session, onSessionChanged }: PosWorkspaceProps) {
  const role = useSessionStore((s) => s.user?.role);
  const canDiscount = role === 'owner' || role === 'admin';
  const lines = usePosCartStore((s) => s.lines);
  const discountCents = usePosCartStore((s) => s.discountCents);
  const clientUuid = usePosCartStore((s) => s.clientUuid);

  const catalog = usePosCatalog();
  const methods = usePaymentMethods();
  const pending = usePendingWebOrders();
  const searchRef = useRef<HTMLInputElement>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [charge, setCharge] = useState<Charge | null>(null);

  // Un descuento heredado de otra sesión (sessionStorage) no debe quedar activo si este usuario no puede aplicarlo.
  useEffect(() => {
    if (!canDiscount && discountCents > 0) usePosCartStore.getState().setDiscount(0);
  }, [canDiscount, discountCents]);

  const cartTotalCents = cartTotal(lines, discountCents);
  const canChargeCart = lines.length > 0 && cartTotalCents > 0;

  function startCartCharge() {
    if (!canChargeCart) return;
    setOverlay(null);
    setCharge({ kind: 'cart' });
  }

  function startOrderCharge(order: PendingWebOrder) {
    setOverlay(null);
    setCharge({ kind: 'order', order, clientUuid: newClientUuid() });
  }

  function handlePaid(sale: Sale) {
    toastSuccess(paidMessage(sale));
    if (charge?.kind === 'cart') {
      // Solo se vacía si el ticket sigue siendo el que se cobró.
      const store = usePosCartStore.getState();
      if (store.clientUuid === clientUuid) store.clear();
    } else {
      pending.refetch();
    }
    setCharge(null);
    onSessionChanged();
  }

  usePosShortcuts({
    searchRef,
    canCharge: canChargeCart,
    onCharge: startCartCharge,
    disabled: overlay !== null || charge !== null,
  });

  const payment = chargeDetails(charge, { lines, discountCents, cartTotalCents, clientUuid });

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <SessionBar
        session={session}
        pendingOrdersCount={pending.data?.length ?? 0}
        onOpenPendingOrders={() => setOverlay('pending')}
        onOpenSales={() => setOverlay('sales')}
      />

      <div className="flex min-h-0 flex-1 gap-3">
        <PosCatalogPanel state={catalog} searchRef={searchRef} />
        <aside aria-label="Ticket de venta" className="hidden w-96 shrink-0 lg:flex">
          <TicketPanel canDiscount={canDiscount} onCharge={startCartCharge} className="w-full" />
        </aside>
      </div>

      <MobileTicketBar onOpenTicket={() => setOverlay('ticket')} onCharge={startCartCharge} />

      <PosModal open={overlay === 'ticket'} onOpenChange={(open) => !open && setOverlay(null)} placement="bottom" title="Ticket">
        <TicketPanel canDiscount={canDiscount} onCharge={startCartCharge} className="max-h-[70dvh] border-0" />
      </PosModal>
      <PendingOrdersSheet
        open={overlay === 'pending'}
        onOpenChange={(open) => !open && setOverlay(null)}
        state={pending}
        onCharge={startOrderCharge}
      />
      <SessionSalesSheet
        open={overlay === 'sales'}
        onOpenChange={(open) => !open && setOverlay(null)}
        sessionId={session.id}
        methods={methods.data}
        onVoided={onSessionChanged}
      />
      {payment && (
        <PaymentDialog
          open
          onOpenChange={(open) => !open && setCharge(null)}
          title={payment.title}
          totalCents={payment.totalCents}
          clientUuid={payment.clientUuid}
          payload={payment.payload}
          methods={methods}
          onPaid={handlePaid}
          onFailed={onSessionChanged}
        />
      )}
    </div>
  );
}

interface ChargeDetails {
  title: string;
  totalCents: number;
  clientUuid: string;
  payload: SalePayload;
}

function chargeDetails(
  charge: Charge | null,
  cart: {
    lines: Parameters<typeof toSaleItems>[0];
    discountCents: number;
    cartTotalCents: number;
    clientUuid: string;
  },
): ChargeDetails | null {
  if (!charge) return null;
  if (charge.kind === 'order') {
    return {
      title: `Cobrar pedido #${charge.order.code}`,
      totalCents: charge.order.totalCents,
      clientUuid: charge.clientUuid,
      payload: { orderId: charge.order.id, discountCents: 0 },
    };
  }
  return {
    title: 'Cobrar',
    totalCents: cart.cartTotalCents,
    clientUuid: cart.clientUuid,
    payload: { items: toSaleItems(cart.lines), discountCents: cart.discountCents },
  };
}
