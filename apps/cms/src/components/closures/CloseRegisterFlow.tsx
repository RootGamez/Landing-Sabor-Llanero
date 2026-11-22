import { useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { formatPEN, hasExpectedCash, type CashSessionDetail, type CashSessionSummary, type CloseSessionInput } from '@sabor/shared';
import { describeDifference } from '../../lib/cashCount';
import { closeCashSession } from '../../lib/closuresApi';
import { formatLimaShort } from '../../lib/closureFormat';
import { useCashCount } from '../../hooks/useCashCount';
import { useMutation } from '../../hooks/useMutation';
import { cn } from '../../lib/utils';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { CashCountPanel } from './CashCountPanel';
import { CashReconciliation } from './CashReconciliation';
import { ReconcileToggle } from './ReconcileToggle';

const NOTES_MAX = 500;
const IRREVERSIBLE = 'Esta acción no se puede deshacer: ya no podrás registrar ventas en esta caja.';

interface CloseRegisterFlowProps {
  session: CashSessionDetail;
  /** Caja cerrada con éxito: recibe la sesión con su snapshot. */
  onClosed: (detail: CashSessionDetail) => void;
  /** Tras un error (p. ej. otra persona ya la cerró) se recarga el estado de la caja. */
  onRefresh: () => void;
}

function confirmDescription(countedCents: number | null, expectedCents: number | null, reconcile: boolean): string {
  if (!reconcile) return `Vas a cerrar la caja sin cuadrar el efectivo. ${IRREVERSIBLE}`;
  const diff = countedCents === null || expectedCents === null ? null : describeDifference(countedCents - expectedCents);
  const counted = countedCents === null ? '—' : formatPEN(countedCents);
  const detail = diff && diff.kind !== 'even' ? ` (${diff.label.toLowerCase()} de ${formatPEN(diff.absCents)})` : '';
  return `Contaste ${counted}${detail}. ${IRREVERSIBLE}`;
}

function buildCloseInput(reconcile: boolean, countedCents: number | null, notes: string): CloseSessionInput | null {
  if (!reconcile) return { reconcile: false, notes };
  return countedCents === null ? null : { reconcile: true, countedCashCents: countedCents, notes };
}

function NotesField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="closure-notes" className="font-display text-xs font-bold uppercase tracking-wide text-text-muted">
        Notas del cierre (opcional)
      </label>
      <textarea
        id="closure-notes"
        rows={3}
        maxLength={NOTES_MAX}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Si hay algo que recordar de este turno, anótalo."
        className="w-full resize-y rounded-xl border-2 border-border bg-surface px-3 py-2 text-base text-text outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
    </div>
  );
}

/** Cierra la caja (irreversible, con confirmación). Cuadrar el efectivo es opcional y viene desmarcado (D15). */
export function CloseRegisterFlow({ session, onClosed, onRefresh }: CloseRegisterFlowProps) {
  const [reconcile, setReconcile] = useState(false);
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const count = useCashCount();
  const { mutate, loading } = useMutation(closeCashSession);

  const { summary } = session;
  const live: CashSessionSummary | null = hasExpectedCash(summary) ? summary : null;
  const countedCents = reconcile ? count.countedCents : null;
  const input = buildCloseInput(reconcile, countedCents, notes.trim());

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    count.markTouched();
    if (input !== null) setConfirming(true);
  }

  async function handleConfirm() {
    if (input === null) return;
    const detail = await mutate(session.id, input);
    setConfirming(false);
    if (detail) onClosed(detail);
    else onRefresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={cn('grid gap-5', reconcile ? 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : 'max-w-2xl')}
    >
      <Card>
        <CardHeader>
          <h2 className="font-display text-xl font-bold leading-tight">{reconcile ? 'Conteo de efectivo' : 'Cierre de caja'}</h2>
          <p className="text-sm text-text-muted">
            Caja abierta desde {formatLimaShort(session.openedAt)} · {summary.salesCount} ventas ·{' '}
            {formatPEN(summary.totalSalesCents)} vendidos.
          </p>
        </CardHeader>
        <CardContent className="gap-5">
          <ReconcileToggle checked={reconcile} onChange={setReconcile} />
          {reconcile && <CashCountPanel count={count} />}
        </CardContent>
      </Card>

      <Card className={cn('h-fit', reconcile && 'lg:sticky lg:top-24')}>
        {reconcile && (
          <CardHeader>
            <h2 className="font-display text-xl font-bold leading-tight">Cuadre de caja</h2>
          </CardHeader>
        )}
        <CardContent className="gap-4">
          {reconcile && live && <CashReconciliation summary={live} countedCents={countedCents} />}
          <NotesField value={notes} onChange={setNotes} />
          <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={input === null}>
            <Lock aria-hidden="true" />
            Cerrar caja
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirming}
        title="¿Cerrar la caja?"
        description={confirmDescription(countedCents, live?.expectedCashCents ?? null, reconcile)}
        confirmLabel="Sí, cerrar caja"
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(false)}
      />
    </form>
  );
}
