import { useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useStore } from 'zustand';
import {
  formatPEN,
  tableDisplayName,
  type CreateSaleInput,
  type DiningTableStatus,
  type Sale,
} from '@sabor/shared';
import { usePaymentMethods, usePosCatalog } from '../../hooks/usePos';
import { useNow } from '../../hooks/useTables';
import { useTableTab } from '../../hooks/useTableTab';
import { closeTableTab } from '../../lib/tablesApi';
import { formatOpenedAgo } from '../../lib/tableTab';
import { PosCartContext } from '../../store/posCartContext';
import { useSessionStore } from '../../store/sessionStore';
import { toastSuccess } from '../../store/toastStore';
import { useConfirm } from '../ui/ConfirmDialog';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { MobileTicketBar } from '../pos/MobileTicketBar';
import { PaymentDialog } from '../pos/PaymentDialog';
import { PosCatalogPanel } from '../pos/PosCatalogPanel';
import { PosModal } from '../pos/PosModal';
import { TicketPanel } from '../pos/TicketPanel';
import { TableTabActions } from './TableTabActions';
import { VoidTabDialog } from './VoidTabDialog';

interface TableOrderViewProps {
  table: DiningTableStatus;
  onSessionChanged: () => void;
  onBack: () => void;
}

type Overlay = 'ticket' | 'pay' | 'void' | null;

function paidMessage(name: string, sale: Sale): string {
  const change = sale.changeCents ?? 0;
  return `${name} cobrada · Venta #${sale.number}${change > 0 ? ` · Vuelto ${formatPEN(change)}` : ''}`;
}

/** Cuenta de una mesa: el menú del POS + ticket de la mesa con "Guardar pedido" y "Cerrar mesa y cobrar". */
export function TableOrderView({ table, onSessionChanged, onBack }: TableOrderViewProps) {
  const name = tableDisplayName(table.label);
  const role = useSessionStore((s) => s.user?.role);
  const isManager = role === 'owner' || role === 'admin';
  const confirm = useConfirm();
  const now = useNow();
  const catalog = usePosCatalog();
  const methods = usePaymentMethods();
  const searchRef = useRef<HTMLInputElement>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const tabState = useTableTab(table.id, name);
  const { store, tab, dirty } = tabState;
  const discountCents = useStore(store, (s) => s.discountCents);

  const baseTotal = tab ? tab.totalCents : 0;
  const chargeTotal = Math.max(baseTotal - Math.min(discountCents, baseTotal), 0);

  async function goBack() {
    if (dirty) {
      const leave = await confirm({
        title: `¿Salir de ${name} sin guardar?`,
        description: 'Los productos que agregaste y no guardaste se perderán.',
        confirmLabel: 'Salir sin guardar',
        cancelLabel: 'Seguir aquí',
      });
      if (!leave) return;
    }
    onBack();
  }

  function startCharge() {
    if (dirty || !tab) return;
    setOverlay('pay');
  }

  const submitClose = (input: CreateSaleInput) => {
    if (!tab) return Promise.reject(new Error('La mesa no tiene cuenta abierta'));
    return closeTableTab(table.id, {
      tabId: tab.id,
      expectedVersion: tab.version,
      discountCents: input.discountCents ?? 0,
      ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
      ...(input.cashReceivedCents !== undefined ? { cashReceivedCents: input.cashReceivedCents } : {}),
    });
  };

  function handlePaid(sale: Sale) {
    toastSuccess(paidMessage(name, sale));
    setOverlay(null);
    onSessionChanged();
    onBack();
  }

  const actions = (
    <TableTabActions
      hasTab={Boolean(tab)}
      hasLines={tabState.lines.length > 0}
      dirty={dirty}
      saving={tabState.saving}
      newUnits={tabState.newUnits}
      totalCents={chargeTotal}
      lockedCents={tabState.lockedCents}
      canVoid={isManager}
      onSave={() => void tabState.save()}
      onDiscard={tabState.discardChanges}
      onCharge={startCharge}
      onVoid={() => setOverlay('void')}
    />
  );

  const ticketProps = {
    canDiscount: isManager && Boolean(tab) && !dirty,
    onCharge: startCharge,
    title: name,
    savedQuantities: tabState.saved,
    canReduceSaved: isManager,
    footerActions: actions,
    allowClear: false,
  };

  return (
    <PosCartContext.Provider value={store}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl2 border-2 border-border bg-card px-3 py-2">
          <button
            type="button"
            onClick={() => void goBack()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-border bg-surface px-3 text-sm font-bold text-text outline-none transition-colors hover:border-forest-line focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Mesas
          </button>
          <h1 className="font-display text-xl font-extrabold text-text">{name}</h1>
          <p className="text-sm text-text-muted" role="status">
            {tab === undefined
              ? 'Cargando cuenta…'
              : tab
                ? `Cuenta ${formatOpenedAgo(tab.openedAt, now)} · ${formatPEN(tab.totalCents)} guardados`
                : 'Mesa libre'}
          </p>
        </div>

        {tabState.loadError && tab === undefined ? (
          <ErrorState message={tabState.loadError} onRetry={() => void tabState.reload()} />
        ) : (
          <div className="flex min-h-0 flex-1 gap-3">
            <PosCatalogPanel state={catalog} searchRef={searchRef} repriceOnLoad={false} />
            <aside aria-label={`Cuenta de ${name}`} className="hidden w-96 shrink-0 lg:flex">
              {tab === undefined ? <Skeleton className="h-full w-full" /> : <TicketPanel {...ticketProps} className="w-full" />}
            </aside>
          </div>
        )}

        <MobileTicketBar
          onOpenTicket={() => setOverlay('ticket')}
          onCharge={() => (dirty ? void tabState.save() : startCharge())}
          summaryLabel={`Ver ${name}`}
          actionLabel={dirty ? 'Guardar' : 'Cobrar'}
          actionDisabled={tab === undefined || tabState.saving || (!dirty && !tab)}
        />

        <PosModal open={overlay === 'ticket'} onOpenChange={(open) => !open && setOverlay(null)} placement="bottom" title={`Cuenta de ${name}`}>
          <TicketPanel {...ticketProps} className="max-h-[70dvh] border-0" />
        </PosModal>

        {overlay === 'pay' && tab && (
          <PaymentDialog
            open
            onOpenChange={(open) => !open && setOverlay(null)}
            title={`Cerrar ${name} y cobrar`}
            totalCents={chargeTotal}
            clientUuid={`mesa-${tab.id}-v${tab.version}`}
            payload={{ discountCents: Math.min(discountCents, baseTotal) }}
            methods={methods}
            submit={submitClose}
            onPaid={handlePaid}
            onFailed={() => {
              setOverlay(null);
              void tabState.reload();
              onSessionChanged();
            }}
          />
        )}

        {overlay === 'void' && tab && (
          <VoidTabDialog
            open
            onOpenChange={(open) => !open && setOverlay(null)}
            tableId={table.id}
            tabId={tab.id}
            tableName={name}
            totalCents={tab.totalCents}
            onVoided={() => {
              toastSuccess(`Cuenta de ${name} anulada. La mesa quedó libre.`);
              setOverlay(null);
              onBack();
            }}
          />
        )}
      </div>
    </PosCartContext.Provider>
  );
}
