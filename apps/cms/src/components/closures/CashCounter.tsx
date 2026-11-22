import { Minus, Plus } from 'lucide-react';
import { formatPEN } from '@sabor/shared';
import {
  DENOMINATIONS,
  MAX_UNITS_PER_DENOMINATION,
  type CashCounts,
  type Denomination,
} from '../../lib/cashCount';

const STEP_BUTTON =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-border bg-surface text-text outline-none transition-colors hover:border-forest focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-40';

interface CounterRowProps {
  denomination: Denomination;
  quantity: number;
  onChange: (cents: number, quantity: number) => void;
}

function CounterRow({ denomination, quantity, onChange }: CounterRowProps) {
  const inputId = `cash-count-${denomination.cents}`;
  const noun = denomination.kind === 'bill' ? 'billetes' : 'monedas';
  return (
    <li className="flex items-center gap-2">
      <label htmlFor={inputId} className="w-20 shrink-0 text-base font-bold tabular-nums text-text">
        {denomination.label}
      </label>
      <button
        type="button"
        className={STEP_BUTTON}
        onClick={() => quantity > 0 && onChange(denomination.cents, quantity - 1)}
        aria-disabled={quantity === 0}
        aria-label={`Quitar uno de ${denomination.label}`}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={quantity === 0 ? '' : String(quantity)}
        placeholder="0"
        onChange={(event) => onChange(denomination.cents, Number(event.target.value.replace(/\D/g, '')))}
        onFocus={(event) => event.currentTarget.select()}
        aria-label={`Cantidad de ${noun} de ${denomination.label}`}
        maxLength={String(MAX_UNITS_PER_DENOMINATION).length}
        className="h-11 w-16 min-w-0 rounded-xl border-2 border-border bg-surface text-center text-lg font-bold tabular-nums text-text outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
      <button
        type="button"
        className={STEP_BUTTON}
        onClick={() => quantity < MAX_UNITS_PER_DENOMINATION && onChange(denomination.cents, quantity + 1)}
        aria-disabled={quantity >= MAX_UNITS_PER_DENOMINATION}
        aria-label={`Agregar uno de ${denomination.label}`}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
      <span className="ml-auto text-sm font-medium tabular-nums text-text-muted">
        {quantity > 0 ? formatPEN(denomination.cents * quantity) : ''}
      </span>
    </li>
  );
}

interface CashCounterProps {
  counts: CashCounts;
  /** El padre actualiza con la forma funcional (`prev => ...`) para no perder toques rápidos. */
  onChange: (cents: number, quantity: number) => void;
}

const GROUPS: ReadonlyArray<{ kind: Denomination['kind']; legend: string }> = [
  { kind: 'bill', legend: 'Billetes' },
  { kind: 'coin', legend: 'Monedas' },
];

/** Contador por denominación (PEN): cada fila suma al total; el monto se calcula, no se escribe. */
export function CashCounter({ counts, onChange }: CashCounterProps) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {GROUPS.map((group) => (
        <fieldset key={group.kind} className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1 font-display text-xs font-bold uppercase tracking-wide text-text-muted">
            {group.legend}
          </legend>
          <ul className="flex flex-col gap-2">
            {DENOMINATIONS.filter((d) => d.kind === group.kind).map((d) => (
              <CounterRow key={d.cents} denomination={d} quantity={counts[d.cents] ?? 0} onChange={onChange} />
            ))}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}
