import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import { formatPEN, type CashSessionSummary } from '@sabor/shared';
import { describeDifference, type DifferenceKind } from '../../lib/cashCount';
import { cn } from '../../lib/utils';

const CASH_METHOD_KEY = 'efectivo';

const STATUS: Record<DifferenceKind, { Icon: typeof Check; box: string; hint: string }> = {
  even: { Icon: Check, box: 'border-success bg-success/10 text-text', hint: 'El efectivo contado coincide con lo esperado.' },
  over: { Icon: ArrowUp, box: 'border-success bg-success/10 text-text', hint: 'Hay más efectivo del esperado. Revisa si falta registrar una venta.' },
  short: { Icon: ArrowDown, box: 'border-sky-strong bg-sky-soft text-text', hint: 'Falta efectivo. Revisa gastos o ventas sin registrar y anótalo en las notas.' },
};

function Row({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', strong && 'border-t-2 border-border pt-2 font-bold')}>
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-base font-bold tabular-nums text-text">{value}</dd>
    </div>
  );
}

interface CashReconciliationProps {
  summary: CashSessionSummary;
  /** `null` mientras el conteo no es un monto válido. */
  countedCents: number | null;
}

/** Esperado vs contado y diferencia. El estado siempre lleva icono y texto, no solo color. */
export function CashReconciliation({ summary, countedCents }: CashReconciliationProps) {
  const cashSales = summary.byMethod.find((m) => m.paymentMethod === CASH_METHOD_KEY)?.totalCents ?? 0;
  const diff = countedCents === null ? null : describeDifference(countedCents - summary.expectedCashCents);
  const status = diff ? STATUS[diff.kind] : null;
  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col gap-1.5">
        <Row label="Efectivo de apertura" value={formatPEN(summary.openingCashCents)} />
        <Row label="+ Ventas en efectivo" value={formatPEN(cashSales)} />
        <Row label="− Gastos pagados de caja" value={formatPEN(summary.cashExpensesCents)} />
        <Row label="Efectivo esperado" value={formatPEN(summary.expectedCashCents)} strong />
        <Row label="Efectivo contado" value={countedCents === null ? '—' : formatPEN(countedCents)} />
      </dl>
      <div
        role="status"
        aria-live="polite"
        className={cn('flex items-start gap-3 rounded-xl border-2 p-3', status ? status.box : 'border-border bg-muted text-text-muted')}
      >
        {status && diff ? (
          <>
            <status.Icon className="mt-0.5 size-6 shrink-0" strokeWidth={3} aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <p className="font-display text-lg font-bold leading-tight">
                {diff.label}
                {diff.kind !== 'even' && ` ${formatPEN(diff.absCents)}`}
              </p>
              <p className="text-sm">{status.hint}</p>
            </div>
          </>
        ) : (
          <p className="text-sm">Cuenta el efectivo para ver la diferencia con lo esperado.</p>
        )}
      </div>
    </div>
  );
}
