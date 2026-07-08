import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { fieldClassName } from './FormField';

interface NumberFieldProps {
  label: string;
  /** Valor numérico controlado; `null`/`undefined` = campo vacío. */
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
  /** Se dispara al perder el foco con el valor final (ya clampeado). */
  onCommit?: (value: number | null) => void;
  id?: string;
  name?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  error?: string;
  hint?: string;
  /** Adorno a la izquierda (p. ej. "S/"). */
  prefix?: ReactNode;
  /** Adorno a la derecha (p. ej. "%"). */
  suffix?: ReactNode;
}

/** Solo dígitos opcionalmente con un punto decimal y signo negativo. */
const NUMERIC_RE = /^-?\d*\.?\d*$/;

function toText(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? '' : String(value);
}

/**
 * Input numérico que SÍ deja borrar el 0 inicial.
 * A diferencia de `<input type="number">`, mantiene un buffer de texto propio:
 * el usuario puede vaciar el campo (emite `null`) y no hay cero fantasma ni
 * flechas de spinner. El clamp min/max se aplica al salir del foco (onBlur),
 * no mientras se escribe, para no pelear con la edición.
 */
export function NumberField({
  label,
  value,
  onValueChange,
  onCommit,
  id,
  name,
  required,
  min,
  max,
  step,
  placeholder,
  className,
  error,
  hint,
  prefix,
  suffix,
}: NumberFieldProps) {
  const fieldId = id ?? name ?? label;
  const [text, setText] = useState<string>(() => toText(value));

  useEffect(() => {
    const buffered = text.trim() === '' ? null : Number(text);
    const normalizedBuffer = buffered != null && Number.isNaN(buffered) ? null : buffered;
    const external = value == null || Number.isNaN(value) ? null : value;
    if (normalizedBuffer !== external) {
      setText(toText(external));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(raw: string) {
    if (raw !== '' && !NUMERIC_RE.test(raw)) return;
    setText(raw);
    if (raw.trim() === '' || raw === '-' || raw === '.' || raw === '-.') {
      onValueChange(null);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) onValueChange(parsed);
  }

  function handleBlur() {
    if (text.trim() === '') {
      onValueChange(null);
      onCommit?.(null);
      return;
    }
    let parsed = Number(text);
    if (Number.isNaN(parsed)) {
      setText('');
      onValueChange(null);
      onCommit?.(null);
      return;
    }
    if (min != null && parsed < min) parsed = min;
    if (max != null && parsed > max) parsed = max;
    setText(String(parsed));
    onValueChange(parsed);
    onCommit?.(parsed);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">
        {label}
      </label>
      <div className="relative flex items-center">
        {prefix != null && (
          <span className="pointer-events-none absolute left-3.5 text-sm font-bold text-text-muted">
            {prefix}
          </span>
        )}
        <input
          id={fieldId}
          name={name}
          type="text"
          inputMode="decimal"
          required={required}
          placeholder={placeholder}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          aria-invalid={error ? true : undefined}
          className={cn(
            fieldClassName,
            prefix != null && 'pl-9',
            suffix != null && 'pr-9',
            'font-semibold tabular-nums',
            className
          )}
          data-step={step}
        />
        {suffix != null && (
          <span className="pointer-events-none absolute right-3.5 text-sm font-bold text-text-muted">
            {suffix}
          </span>
        )}
      </div>
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
