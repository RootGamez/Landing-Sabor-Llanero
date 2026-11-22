import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Globe, History, Lock } from 'lucide-react';
import { formatPEN, type CashSessionDetail } from '@sabor/shared';
import { formatDateTime } from '../../lib/format';
import { cn } from '../../lib/utils';

interface SessionBarProps {
  session: CashSessionDetail;
  pendingOrdersCount: number;
  onOpenPendingOrders: () => void;
  onOpenSales: () => void;
}

const BAR_BUTTON =
  'relative inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-border bg-surface px-3 text-sm max-sm:flex-1 sm:gap-2 sm:px-4 font-bold text-text outline-none transition-colors hover:border-forest-line focus-visible:ring-2 focus-visible:ring-ring';

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col leading-tight">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="text-sm font-bold tabular-nums text-text">{children}</dd>
    </div>
  );
}

/** Resumen del turno (abierta desde, # ventas, total) y accesos a pedidos web, ventas del turno y cierre. */
export function SessionBar({ session, pendingOrdersCount, onOpenPendingOrders, onOpenSales }: SessionBarProps) {
  const { summary } = session;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl2 border-2 border-border bg-card px-4 py-2">
      <dl className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <Stat label="Caja abierta desde">{formatDateTime(session.openedAt)}</Stat>
        <Stat label="Ventas">{summary.salesCount}</Stat>
        <Stat label="Total del turno">{formatPEN(summary.totalSalesCents)}</Stat>
      </dl>
      <span className="flex-1" />
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <button type="button" onClick={onOpenPendingOrders} className={BAR_BUTTON}>
          <Globe className="size-4" aria-hidden="true" />
          <span>
            Pedidos<span className="max-sm:sr-only"> web</span>
          </span>
          <span
            className={cn(
              'inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums',
              pendingOrdersCount > 0 ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-text-muted',
            )}
          >
            <span className="sr-only">por cobrar: </span>
            {pendingOrdersCount}
          </span>
        </button>
        <button type="button" onClick={onOpenSales} className={BAR_BUTTON}>
          <History className="size-4" aria-hidden="true" />
          Ventas<span className="max-sm:sr-only"> del turno</span>
        </button>
        <Link to="/ventas/cierres" className={cn(BAR_BUTTON, 'border-forest text-forest')}>
          <Lock className="size-4" aria-hidden="true" />
          Cerrar caja
        </Link>
      </div>
    </div>
  );
}
