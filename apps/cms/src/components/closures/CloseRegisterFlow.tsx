import { useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { formatPEN, type CashSessionDetail } from '@sabor/shared';
import { EMPTY_COUNTS, describeDifference, sumCounts, withCount, type CashCounts } from '../../lib/cashCount';
import { closeCashSession } from '../../lib/closuresApi';
import { parseSolesToCents } from '../../lib/posCart';
import { formatLimaShort } from '../../lib/closureFormat';
import { useMutation } from '../../hooks/useMutation';
import { ConfirmDialog } from '../expenses/ConfirmDialog';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { CashCounter } from './CashCounter';
import { CashReconciliation } from './CashReconciliation';
import { CountModeToggle, type CountMode } from './CountModeToggle';

const NOTES_MAX = 500;

interface CloseRegisterFlowProps {
  session: CashSessionDetail;
  /** Caja cerrada con éxito: recibe la sesión con su snapshot. */
  onClosed: (detail: CashSessionDetail) => void;
  /** Tras un error (p. ej. otra persona ya la cerró) se recarga el estado de la caja. */
  onRefresh: () => void;
}

/** Cuenta el efectivo, compara con lo esperado y cierra la caja (irreversible, con confirmación). */
export function CloseRegisterFlow({ session, onClosed, onRefresh }: CloseRegisterFlowProps) {
  const [mode, setMode] = useState<CountMode>('count');
  const [counts, setCounts] = useState<CashCounts>(EMPTY_COUNTS);
  const [amountText, setAmountText] = useState('');
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [touched, setTouched] = useState(false);
  const [hasCounted, setHasCounted] = useState(false);
  const { mutate, loading } = useMutation(closeCashSession);

  const { summary } = session;
  // En modo conteo no hay monto hasta que se cuenta algo (o se confirma que no hay efectivo): nunca se cierra con un 0 implícito.
  const countedCents = mode === 'count' ? (hasCounted ? sumCounts(counts) : null) : parseSolesToCents(amountText);
  const exceedsMax = mode === 'count' && hasCounted && countedCents === null;
  const amountError =
    mode === 'amount' && touched && countedCents === null ? 'Escribe el efectivo contado; si no hay, escribe 0.' : undefined;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (countedCents !== null) setConfirming(true);
  }

  async function handleConfirm() {
    if (countedCents === null) return;
    const detail = await mutate(session.id, { countedCashCents: countedCents, notes: notes.trim() });
    setConfirming(false);
    if (detail) onClosed(detail);
    else onRefresh();
  }

  const diff = countedCents === null ? null : describeDifference(countedCents - summary.expectedCashCents);

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card>
        <CardHeader>
          <h2 className="font-display text-xl font-bold leading-tight">Conteo de efectivo</h2>
          <p className="text-sm text-text-muted">
            Caja abierta desde {formatLimaShort(session.openedAt)} · {summary.salesCount} ventas ·{' '}
            {formatPEN(summary.totalSalesCents)} vendidos.
          </p>
        </CardHeader>
        <CardContent className="gap-5">
          <CountModeToggle mode={mode} onChange={setMode} />
          {mode === 'count' ? (
            <>
              <CashCounter
                counts={counts}
                onChange={(cents, quantity) => {
                  setCounts((prev) => withCount(prev, cents, quantity));
                  setHasCounted(true);
                }}
              />
              {!hasCounted && (
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setHasCounted(true)}>
                  No hay efectivo: contar S/ 0.00
                </Button>
              )}
              {exceedsMax && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  El total supera el máximo permitido. Revisa las cantidades.
                </p>
              )}
            </>
          ) : (
            <div className="flex max-w-sm flex-col gap-1.5">
              <label htmlFor="closure-amount" className="font-display text-xs font-bold uppercase tracking-wide text-text-muted">
                Efectivo contado (S/)
              </label>
              <input
                id="closure-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="0.00"
                aria-invalid={amountError ? true : undefined}
                aria-describedby={amountError ? 'closure-amount-error' : undefined}
                className="h-14 w-full rounded-xl border-2 border-border bg-surface px-4 text-2xl font-bold tabular-nums text-text outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
              {amountError && (
                <p id="closure-amount-error" role="alert" className="text-xs font-medium text-destructive">
                  {amountError}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="h-fit lg:sticky lg:top-24">
        <CardHeader>
          <h2 className="font-display text-xl font-bold leading-tight">Cuadre de caja</h2>
        </CardHeader>
        <CardContent className="gap-4">
          <CashReconciliation summary={summary} countedCents={countedCents} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="closure-notes" className="font-display text-xs font-bold uppercase tracking-wide text-text-muted">
              Notas del cierre (opcional)
            </label>
            <textarea
              id="closure-notes"
              rows={3}
              maxLength={NOTES_MAX}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Si hay diferencia, anota el motivo."
              className="w-full resize-y rounded-xl border-2 border-border bg-surface px-3 py-2 text-base text-text outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={mode === 'count' && countedCents === null}>
            <Lock aria-hidden="true" />
            Cerrar caja
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirming}
        title="¿Cerrar la caja?"
        description={`Contaste ${countedCents === null ? '—' : formatPEN(countedCents)}${
          diff && diff.kind !== 'even' ? ` (${diff.label.toLowerCase()} de ${formatPEN(diff.absCents)})` : ''
        }. Esta acción no se puede deshacer: ya no podrás registrar ventas en esta caja.`}
        confirmLabel="Sí, cerrar caja"
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(false)}
      />
    </form>
  );
}
