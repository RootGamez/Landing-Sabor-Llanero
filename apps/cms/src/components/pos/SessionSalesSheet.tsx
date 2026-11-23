import { useMemo, useState, type FormEvent } from 'react';
import { Receipt } from 'lucide-react';
import { formatPEN, type PaymentMethod, type Sale } from '@sabor/shared';
import { useSessionSales } from '../../hooks/usePos';
import { useMutation } from '../../hooks/useMutation';
import { voidSale } from '../../lib/posApi';
import { formatClock, isVoided, summarizeItems } from '../../lib/posFormat';
import { toReceiptData } from '../../lib/receiptData';
import { cn } from '../../lib/utils';
import { toastSuccess } from '../../store/toastStore';
import { Badge } from '../ui/badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { ReceiptDialog } from '../receipts/ReceiptDialog';
import { PosModal } from './PosModal';
import { SaleItemsWithDetails, hasLineDetails } from './LineDetails';

const REASON_MAX = 200;

interface SessionSalesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number;
  methods: readonly PaymentMethod[] | undefined;
  /** Tras anular: refresca los totales del turno. */
  onVoided: () => void;
}

function VoidForm({ sale, onDone, onCancel }: { sale: Sale; onDone: () => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  const { mutate, loading } = useMutation(voidSale);
  const trimmed = reason.trim();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) return;
    const result = await mutate(sale.id, trimmed);
    if (result) {
      toastSuccess(`Venta #${sale.number} anulada`);
      onDone();
    }
  }

  const fieldId = `void-reason-${sale.id}`;
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-border pt-2">
      <label htmlFor={fieldId} className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">
        Motivo de la anulación
      </label>
      <input
        id={fieldId}
        type="text"
        value={reason}
        maxLength={REASON_MAX}
        onChange={(event) => setReason(event.target.value)}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- el cajero acaba de pedir anular: el motivo es el siguiente paso.
        autoFocus
        required
        className="h-11 w-full rounded-xl border-2 border-border bg-surface px-3 text-base text-text outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
      <div className="flex gap-2">
        <Button type="submit" variant="danger" className="h-11 flex-1" loading={loading} disabled={!trimmed}>
          Anular venta
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

interface SaleReceiptDialogProps {
  sale: Sale;
  methodLabels: ReadonlyMap<string, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Calcula los datos del comprobante aquí dentro: solo existe para las ventas cuyo comprobante se abrió. */
function SaleReceiptDialog({ sale, methodLabels, open, onOpenChange }: SaleReceiptDialogProps) {
  const receipt = useMemo(() => toReceiptData(sale, methodLabels), [sale, methodLabels]);
  return <ReceiptDialog open={open} onOpenChange={onOpenChange} data={receipt} />;
}

interface SaleRowProps {
  sale: Sale;
  methodLabels: ReadonlyMap<string, string>;
  onVoided: () => void;
}

function SaleRow({ sale, methodLabels, onVoided }: SaleRowProps) {
  const [voiding, setVoiding] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  // Se monta al abrir por primera vez y queda montado para que el diálogo conserve su animación de cierre.
  const [receiptRequested, setReceiptRequested] = useState(false);
  const voided = isVoided(sale);
  const methodLabel = methodLabels.get(sale.paymentMethod) ?? sale.paymentMethod;

  function openReceipt() {
    setReceiptRequested(true);
    setReceiptOpen(true);
  }

  return (
    <li className={cn('flex flex-col gap-1.5 rounded-xl border-2 border-border bg-card p-3', voided && 'opacity-70')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-text">
            Venta #{sale.number}
            {voided && <Badge variant="sky">Anulada</Badge>}
          </p>
          <p className="text-xs text-text-muted">
            {formatClock(sale.createdAt)} · {methodLabel}
            {sale.orderId !== null && ' · Pedido web'}
          </p>
        </div>
        <p className={cn('text-lg font-extrabold tabular-nums text-text', voided && 'line-through')}>
          {formatPEN(sale.totalCents)}
        </p>
      </div>
      {hasLineDetails(sale.items) ? (
        <SaleItemsWithDetails items={sale.items} />
      ) : (
        <p className="text-sm text-text">{summarizeItems(sale.items)}</p>
      )}
      {voided && sale.voidReason && <p className="text-xs text-text-muted">Motivo: {sale.voidReason}</p>}
      {!voiding && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="md" onClick={openReceipt}>
            <Receipt aria-hidden="true" />
            Comprobante
            <span className="sr-only"> de la venta #{sale.number}</span>
          </Button>
          {!voided && (
            <Button variant="outline" size="md" onClick={() => setVoiding(true)}>
              Anular
              <span className="sr-only"> la venta #{sale.number}</span>
            </Button>
          )}
        </div>
      )}
      {receiptRequested && (
        <SaleReceiptDialog sale={sale} methodLabels={methodLabels} open={receiptOpen} onOpenChange={setReceiptOpen} />
      )}
      {voiding && (
        <VoidForm
          sale={sale}
          onCancel={() => setVoiding(false)}
          onDone={() => {
            setVoiding(false);
            onVoided();
          }}
        />
      )}
    </li>
  );
}

function SalesList({ sessionId, methods, onVoided }: Omit<SessionSalesSheetProps, 'open' | 'onOpenChange'>) {
  const sales = useSessionSales(sessionId);
  const labels = useMemo(() => new Map((methods ?? []).map((method) => [method.key, method.label])), [methods]);

  function handleVoided() {
    sales.refetch();
    onVoided();
  }

  if (sales.error && !sales.data) return <ErrorState message={sales.error} onRetry={sales.refetch} />;
  if (!sales.data) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (sales.data.items.length === 0) {
    return <EmptyState title="Aún no hay ventas en este turno" description="Las ventas que registres aparecerán aquí." />;
  }
  return (
    <ul className="flex flex-col gap-3">
      {sales.data.items.map((sale) => (
        <SaleRow
          key={sale.id}
          sale={sale}
          methodLabels={labels}
          onVoided={handleVoided}
        />
      ))}
    </ul>
  );
}

/** Ventas de la caja abierta, de la más reciente a la más antigua, con anulación (motivo obligatorio, D4). */
export function SessionSalesSheet({ open, onOpenChange, ...listProps }: SessionSalesSheetProps) {
  return (
    <PosModal
      open={open}
      onOpenChange={onOpenChange}
      placement="right"
      title="Ventas del turno"
      description="Si te equivocaste, anula la venta con un motivo. No se borra: queda registrada."
    >
      <SalesList {...listProps} />
    </PosModal>
  );
}
