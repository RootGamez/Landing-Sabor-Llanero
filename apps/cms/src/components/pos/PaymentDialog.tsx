import { useState, type FormEvent } from 'react';
import { DEFAULT_PAYMENT_METHOD, formatPEN, type CreateSaleInput, type PaymentMethod, type Sale } from '@sabor/shared';
import type { AsyncState } from '../../hooks/useAsync';
import { useMutation } from '../../hooks/useMutation';
import { createSale } from '../../lib/posApi';
import { cashShortcuts, centsToInputText, parseSolesToCents } from '../../lib/posCart';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { PosModal } from './PosModal';

/** Clave del método efectivo en `payment_methods` (D8): el único que lleva "recibido" y vuelto. */
const CASH_METHOD_KEY = 'efectivo';

export type SalePayload = Pick<CreateSaleInput, 'items' | 'orderId' | 'discountCents'>;

type MethodsState = AsyncState<PaymentMethod[]> & { refetch: () => void };

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  totalCents: number;
  /** Estable entre reintentos: si el POST llegó pero la respuesta se perdió, el servidor devuelve la misma venta. */
  clientUuid: string;
  payload: SalePayload;
  methods: MethodsState;
  onPaid: (sale: Sale) => void;
  /** Se llama cuando el cobro falló (p. ej. la caja se cerró) para que el POS refresque su estado. */
  onFailed: () => void;
}

export function PaymentDialog({ open, onOpenChange, title, ...formProps }: PaymentDialogProps) {
  const { mutate, loading } = useMutation(createSale);
  // Con el cobro en vuelo no se puede cerrar (Esc, X o clic fuera): la respuesta debe aplicarse al ticket correcto.
  const handleOpenChange = (next: boolean) => {
    if (!next && loading) return;
    onOpenChange(next);
  };
  return (
    <PosModal open={open} onOpenChange={handleOpenChange} title={title} description="Elige cómo paga el cliente o cobra directo.">
      <PaymentForm {...formProps} submitSale={mutate} loading={loading} />
    </PosModal>
  );
}

type PaymentFormProps = Omit<PaymentDialogProps, 'open' | 'onOpenChange' | 'title'> & {
  submitSale: (input: CreateSaleInput) => Promise<Sale | undefined>;
  loading: boolean;
};

/** Ventana tras abrir el diálogo en la que se ignora el envío (evita que un Enter doble cobre sin querer). */
const SUBMIT_GRACE_MS = 400;

/** Botones de alternancia: ninguno viene marcado; volver a tocar el marcado lo desmarca. */
function MethodToggles({
  methods,
  selected,
  onToggle,
}: {
  methods: readonly PaymentMethod[];
  selected: string | null;
  onToggle: (key: string) => void;
}) {
  return (
    <div role="group" aria-labelledby="pos-method-legend" className="flex flex-col gap-2">
      <p id="pos-method-legend" className="mb-1 text-xs font-bold font-display uppercase tracking-wide text-text-muted">
        Método de pago (opcional)
      </p>
      <div className="grid grid-cols-3 gap-2">
        {methods.map((method) => (
          <button
            key={method.key}
            type="button"
            aria-pressed={selected === method.key}
            onClick={() => onToggle(method.key)}
            className={cn(
              'flex min-h-14 items-center justify-center rounded-xl border-2 px-2 text-center text-sm font-bold text-text outline-none transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              selected === method.key
                ? 'border-forest bg-accent text-accent-foreground shadow-sticker'
                : 'border-border bg-surface hover:border-forest-line',
            )}
          >
            {method.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CashFields({
  totalCents,
  text,
  onTextChange,
}: {
  totalCents: number;
  text: string;
  onTextChange: (text: string) => void;
}) {
  const parsed = text.trim() === '' ? totalCents : parseSolesToCents(text);
  const received = parsed ?? 0;
  const shortfall = parsed !== null && parsed < totalCents;
  const pressed = parseSolesToCents(text);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pos-received" className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">
          Recibido (S/)
        </label>
        <input
          id="pos-received"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={centsToInputText(totalCents)}
          aria-invalid={parsed === null || shortfall ? true : undefined}
          aria-describedby="pos-change"
          className="h-14 w-full rounded-xl border-2 border-border bg-surface px-4 text-2xl font-bold tabular-nums text-text outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
        />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Montos rápidos">
        {[totalCents, ...cashShortcuts(totalCents)].map((amount, index) => (
          <button
            key={amount}
            type="button"
            aria-pressed={pressed === amount}
            onClick={() => onTextChange(centsToInputText(amount))}
            className={cn(
              'min-h-11 rounded-full border-2 px-4 text-sm font-bold tabular-nums text-text outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              pressed === amount ? 'border-forest bg-lime-soft' : 'border-border bg-surface hover:border-forest-line',
            )}
          >
            {index === 0 ? 'Exacto' : formatPEN(amount)}
          </button>
        ))}
      </div>
      <p
        id="pos-change"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          'rounded-xl border-2 px-4 py-3 text-center',
          shortfall || parsed === null ? 'border-sky-strong bg-sky-soft text-text' : 'border-success bg-[#dcefe2] text-text',
        )}
      >
        {parsed === null ? (
          <span className="text-base font-bold">Escribe un monto válido, por ejemplo 50 o 20.50</span>
        ) : shortfall ? (
          <span className="text-lg font-bold tabular-nums">Faltan {formatPEN(totalCents - received)}</span>
        ) : (
          <>
            <span className="block text-xs font-bold font-display uppercase tracking-wide">Vuelto</span>
            <span className="text-4xl font-extrabold tabular-nums">{formatPEN(received - totalCents)}</span>
          </>
        )}
      </p>
    </div>
  );
}

function MethodsLoader({ methods }: { methods: MethodsState }) {
  if (methods.error && !methods.data) return <ErrorState message={methods.error} onRetry={methods.refetch} />;
  if (methods.data) {
    return <ErrorState message="No hay métodos de pago activos. Actívalos antes de cobrar." onRetry={methods.refetch} />;
  }
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}

function PaymentForm({
  totalCents,
  clientUuid,
  payload,
  methods,
  onPaid,
  onFailed,
  submitSale,
  loading,
}: PaymentFormProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [cashText, setCashText] = useState('');
  const [openedAt] = useState(() => Date.now());

  const available = methods.data ?? [];
  // D15: nada preseleccionado. Sin elección, la API registra el método por defecto (Yape).
  const isCash = selectedKey === CASH_METHOD_KEY;
  const chargeLabel = available.find((m) => m.key === (selectedKey ?? DEFAULT_PAYMENT_METHOD))?.label ?? 'Yape';
  const receivedCents = cashText.trim() === '' ? totalCents : parseSolesToCents(cashText);
  const cashInvalid = isCash && (receivedCents === null || receivedCents < totalCents);
  // Si Yape está desactivado no hay método por defecto: hay que elegir uno (la API rechazaría el cobro).
  const defaultAvailable = available.some((m) => m.key === DEFAULT_PAYMENT_METHOD);
  const canSubmit = !cashInvalid && !loading && (selectedKey !== null || defaultAvailable);
  const toggleMethod = (key: string) => setSelectedKey((current) => (current === key ? null : key));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || Date.now() - openedAt < SUBMIT_GRACE_MS) return;
    const sale = await submitSale({
      clientUuid,
      ...payload,
      ...(selectedKey !== null ? { paymentMethod: selectedKey } : {}),
      ...(isCash && receivedCents !== null ? { cashReceivedCents: receivedCents } : {}),
    });
    if (sale) onPaid(sale);
    else onFailed();
  }

  if (available.length === 0) return <MethodsLoader methods={methods} />;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="flex items-baseline justify-between text-text" role="status" aria-live="polite">
        <span className="font-display text-sm font-bold uppercase tracking-wide">Total a cobrar</span>
        <span className="text-4xl font-extrabold tabular-nums">{formatPEN(totalCents)}</span>
      </p>
      <MethodToggles methods={available} selected={selectedKey} onToggle={toggleMethod} />
      {selectedKey === null && (
        <p className="text-sm text-text-muted">
          {defaultAvailable ? `Si no eliges, se registra como ${chargeLabel}.` : 'Elige un método de pago para cobrar.'}
        </p>
      )}
      {isCash && <CashFields totalCents={totalCents} text={cashText} onTextChange={setCashText} />}
      <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-border bg-surface p-4">
        <Button
          type="submit"
          size="lg"
          className="h-16 w-full text-lg"
          loading={loading}
          disabled={!canSubmit}
          data-autofocus=""
        >
          Cobrar ({chargeLabel})
        </Button>
      </div>
    </form>
  );
}
