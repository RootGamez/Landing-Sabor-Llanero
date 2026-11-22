import { useState } from 'react';
import { EMPTY_COUNTS, sumCounts, withCount, type CashCounts } from '../lib/cashCount';
import { parseSolesToCents } from '../lib/posCart';
import type { CountMode } from '../components/closures/CountModeToggle';

/** Estado del arqueo de efectivo: por conteo de billetes/monedas o por monto directo. */
export function useCashCount() {
  const [mode, setMode] = useState<CountMode>('count');
  const [counts, setCounts] = useState<CashCounts>(EMPTY_COUNTS);
  const [amountText, setAmountText] = useState('');
  const [touched, setTouched] = useState(false);
  const [hasCounted, setHasCounted] = useState(false);

  // En modo conteo no hay monto hasta que se cuenta algo (o se confirma que no hay efectivo): nunca se cierra con un 0 implícito.
  const countedCents = mode === 'count' ? (hasCounted ? sumCounts(counts) : null) : parseSolesToCents(amountText);
  const exceedsMax = mode === 'count' && hasCounted && countedCents === null;
  const amountError =
    mode === 'amount' && touched && countedCents === null ? 'Escribe el efectivo contado; si no hay, escribe 0.' : undefined;

  return {
    mode,
    setMode,
    counts,
    changeCount: (cents: number, quantity: number) => {
      setCounts((prev) => withCount(prev, cents, quantity));
      setHasCounted(true);
    },
    amountText,
    setAmountText,
    hasCounted,
    confirmNoCash: () => setHasCounted(true),
    markTouched: () => setTouched(true),
    countedCents,
    exceedsMax,
    amountError,
  };
}

export type CashCountState = ReturnType<typeof useCashCount>;
