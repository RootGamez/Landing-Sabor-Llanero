import { useState } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { fieldClassName } from './fieldStyles';
import { Input, Textarea } from './Input';
import { useFieldId } from './useFieldId';

export interface FieldShellProps {
  /** Etiqueta visible. Sin ella el control necesita `aria-label`. */
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Id del control (si falta se genera uno). */
  id?: string;
}

interface FieldProps {
  label?: string;
  /** Id del control etiquetado; los mensajes derivan `-hint` / `-error` de él. */
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** `true` para controles compuestos (radios, rangos): la etiqueta nombra al grupo vía `aria-labelledby`. */
  group?: boolean;
  className?: string;
  children: ReactNode;
}

const LABEL_CLASS = 'text-xs font-bold font-display uppercase tracking-wide text-text-muted';

/** Id del elemento que etiqueta a un control compuesto (ver `Field` con `group`). */
export function fieldLabelId(fieldId: string): string {
  return `${fieldId}-label`;
}

/**
 * Envoltorio común de todos los controles: etiqueta + control + ayuda/error.
 * El control debe aplicar `fieldA11y(htmlFor, error, hint)` para enlazar los mensajes.
 */
export function Field({ label, htmlFor, error, hint, required, group, className, children }: FieldProps) {
  const requiredMark = required ? (
    <span aria-hidden="true" className="ml-0.5 text-destructive">
      *
    </span>
  ) : null;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label &&
        (group ? (
          <span id={fieldLabelId(htmlFor)} className={LABEL_CLASS}>
            {label}
            {requiredMark}
          </span>
        ) : (
          <label id={fieldLabelId(htmlFor)} htmlFor={htmlFor} className={LABEL_CLASS}>
            {label}
            {requiredMark}
          </label>
        ))}
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Enlaza el control con su mensaje de error/ayuda (los ids los genera `Field`). */
export function fieldA11y(fieldId: string, error?: string, hint?: string) {
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return { 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy } as const;
}

export { fieldClassName } from './fieldStyles';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, id, className, ...props }: TextFieldProps) {
  const fieldId = useFieldId(id ?? props.name);
  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} required={props.required}>
      <Input id={fieldId} {...fieldA11y(fieldId, error, hint)} className={className} {...props} />
    </Field>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextAreaField({ label, error, hint, id, className, ...props }: TextAreaFieldProps) {
  const fieldId = useFieldId(id ?? props.name);
  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} required={props.required}>
      <Textarea id={fieldId} {...fieldA11y(fieldId, error, hint)} className={className} {...props} />
    </Field>
  );
}

/** @deprecated Select nativo: usa `Select` de `./Select`. Se mantiene solo hasta migrar la fase 2 (gastos). */
interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function SelectField({ label, error, hint, id, className, children, ...props }: SelectFieldProps) {
  const fieldId = useFieldId(id ?? props.name);
  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} required={props.required}>
      <select id={fieldId} {...fieldA11y(fieldId, error, hint)} className={cn(fieldClassName, 'cursor-pointer', className)} {...props}>
        {children}
      </select>
    </Field>
  );
}

type PasswordFieldProps = Omit<TextFieldProps, 'type'>;

/**
 * Campo de contraseña con botón mostrar/ocultar. No bloquea el pegado (los
 * gestores de contraseñas lo necesitan). Usar `autoComplete="new-password"` al
 * crear/cambiar y `current-password` al verificar la actual.
 */
export function PasswordField({ label, error, hint, id, className, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const fieldId = useFieldId(id ?? props.name);
  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} required={props.required}>
      <div className="relative">
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          {...fieldA11y(fieldId, error, hint)}
          className={cn(fieldClassName, 'pr-24', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-controls={fieldId}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute inset-y-0 right-0 min-h-11 cursor-pointer rounded-lg px-3 text-xs font-semibold text-primary hover:underline"
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
    </Field>
  );
}
