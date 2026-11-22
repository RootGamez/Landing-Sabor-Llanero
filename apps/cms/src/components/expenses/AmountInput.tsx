import { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { fieldClassName } from '../ui/FormField';

interface AmountInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  /** Tamaño grande para el registro rápido (teclado numérico en móvil). */
  large?: boolean;
}

/** Monto en soles: solo dígitos y un separador decimal; el teclado numérico aparece en móvil. */
export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  { id, value, onChange, onBlur, error, large },
  ref,
) {
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
          placeholder="0.00"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.,]/g, ''))}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(fieldClassName, 'tabular-nums font-bold', large ? 'h-16 pl-14 text-4xl' : 'pl-10')}
        />
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
});
