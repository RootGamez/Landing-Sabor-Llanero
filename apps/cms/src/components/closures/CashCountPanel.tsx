import type { CashCountState } from '../../hooks/useCashCount';
import { Button } from '../ui/Button';
import { CashCounter } from './CashCounter';
import { CountModeToggle } from './CountModeToggle';

function AmountField({ count }: { count: CashCountState }) {
  return (
    <div className="flex max-w-sm flex-col gap-1.5">
      <label htmlFor="closure-amount" className="font-display text-xs font-bold uppercase tracking-wide text-text-muted">
        Efectivo contado (S/)
      </label>
      <input
        id="closure-amount"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={count.amountText}
        onChange={(event) => count.setAmountText(event.target.value)}
        onBlur={count.markTouched}
        placeholder="0.00"
        aria-invalid={count.amountError ? true : undefined}
        aria-describedby={count.amountError ? 'closure-amount-error' : undefined}
        className="h-14 w-full rounded-xl border-2 border-border bg-surface px-4 text-2xl font-bold tabular-nums text-text outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
      {count.amountError && (
        <p id="closure-amount-error" role="alert" className="text-xs font-medium text-destructive">
          {count.amountError}
        </p>
      )}
    </div>
  );
}

/** Contador de efectivo (billetes y monedas) o monto directo. Solo se muestra al cuadrar la caja. */
export function CashCountPanel({ count }: { count: CashCountState }) {
  return (
    <div className="flex flex-col gap-5">
      <CountModeToggle mode={count.mode} onChange={count.setMode} />
      {count.mode === 'count' ? (
        <>
          <CashCounter counts={count.counts} onChange={count.changeCount} />
          {!count.hasCounted && (
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={count.confirmNoCash}>
              No hay efectivo: contar S/ 0.00
            </Button>
          )}
          {count.exceedsMax && (
            <p role="alert" className="text-sm font-medium text-destructive">
              El total supera el máximo permitido. Revisa las cantidades.
            </p>
          )}
        </>
      ) : (
        <AmountField count={count} />
      )}
    </div>
  );
}
