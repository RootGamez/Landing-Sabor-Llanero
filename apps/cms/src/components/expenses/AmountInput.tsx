import { forwardRef, type KeyboardEvent } from 'react';
import { evaluateAmountExpression, formatPEN, hasOperator, MAX_EXPRESSION_LENGTH } from '@sabor/shared';
import { cn } from '../../lib/utils';
import { fieldClassName } from '../ui/FormField';
import { centsToAmountText } from './expenseUtils';

interface AmountInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  /** Tamaño grande para el registro rápido (teclado numérico en móvil). */
  large?: boolean;
}

/** Termina en cifra o ')': ahí tiene sentido agregar un "+". */
const CAN_APPEND_PLUS = /[\d.,)]\s*$/;
const ALLOWED_CHARS = /[^\d.,+\-*/() ]/g;

/** Si el texto es una operación válida, su total como monto editable ("35.00"); si no, `null`. */
function collapsedTotal(text: string): string | null {
  if (!hasOperator(text)) return null;
  const result = evaluateAmountExpression(text);
  return result.ok ? centsToAmountText(result.cents) : null;
}

/**
 * Monto en soles. Acepta un número ("12.50") o una operación como en HomeBank
 * ("12+10+5+8"): mientras escribes se ve el resultado y, al confirmar con Enter
 * o al salir del campo, el texto se reemplaza por el total.
 */
export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  { id, value, onChange, onBlur, error, large },
  ref,
) {
  const live = hasOperator(value) ? evaluateAmountExpression(value) : null;
  const resultId = `${id}-result`;
  const describedBy = [error ? `${id}-error` : null, live?.ok ? resultId : null].filter(Boolean).join(' ') || undefined;

  function collapse() {
    const total = collapsedTotal(value);
    if (total !== null) onChange(total);
  }

  function appendPlus() {
    if (CAN_APPEND_PLUS.test(value)) onChange(`${value.trim()}+`);
    document.getElementById(id)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Sin preventDefault: el Enter además envía el formulario, que evalúa la misma operación.
    if (event.key === 'Enter') collapse();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">
        Monto (S/)
      </label>
      <div className="relative flex items-center">
        <span aria-hidden="true" className={cn('pointer-events-none absolute left-4 font-bold text-text-muted', large ? 'text-2xl' : 'text-sm')}>
          S/
        </span>
        <input
          id={id}
          ref={ref}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          maxLength={MAX_EXPRESSION_LENGTH}
          placeholder="0.00"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(ALLOWED_CHARS, ''))}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            collapse();
            onBlur?.();
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(fieldClassName, 'tabular-nums font-bold pr-14', large ? 'h-16 pl-14 text-4xl' : 'pl-10')}
        />
        {/* El teclado numérico del celular no trae "+": este botón permite sumar montos sin cambiar de teclado. */}
        <button
          type="button"
          onClick={appendPlus}
          aria-label="Sumar otro monto"
          className="absolute right-2 inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-xl font-bold text-forest hover:bg-muted"
        >
          +
        </button>
      </div>
      <p id={resultId} aria-live="polite" className={cn('text-sm font-bold tabular-nums text-forest', !live?.ok && 'sr-only')}>
        {live?.ok ? `= ${formatPEN(live.cents)}` : ''}
      </p>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
      {large && !value && <p className="text-xs text-text-muted">Puedes sumar varios montos, por ejemplo 12+10+5.</p>}
    </div>
  );
});
