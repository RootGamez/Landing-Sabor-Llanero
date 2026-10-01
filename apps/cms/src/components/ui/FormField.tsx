import { useState } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface FieldWrapperProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

function FieldWrapper({ label, htmlFor, error, hint, children }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">
        {label}
      </label>
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

/** Enlaza el input con su mensaje de error/ayuda (los ids los genera `FieldWrapper`). */
function fieldA11y(fieldId: string, error?: string, hint?: string) {
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return { 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy } as const;
}

/** Estilo compartido de inputs: look shadcn con borde grueso y focus ring de marca. */
export const fieldClassName =
  'w-full rounded-xl border-2 border-border bg-surface px-3.5 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted/60 hover:border-forest-line/60 focus:border-primary focus:ring-2 focus:ring-ring/30';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, id, className, ...props }: TextFieldProps) {
  const fieldId = id ?? props.name ?? label;
  return (
    <FieldWrapper label={label} htmlFor={fieldId} error={error} hint={hint}>
      <input id={fieldId} {...fieldA11y(fieldId, error, hint)} className={cn(fieldClassName, className)} {...props} />
    </FieldWrapper>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextAreaField({ label, error, hint, id, className, ...props }: TextAreaFieldProps) {
  const fieldId = id ?? props.name ?? label;
  return (
    <FieldWrapper label={label} htmlFor={fieldId} error={error} hint={hint}>
      <textarea id={fieldId} {...fieldA11y(fieldId, error, hint)} className={cn(fieldClassName, className)} rows={4} {...props} />
    </FieldWrapper>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function SelectField({ label, error, hint, id, className, children, ...props }: SelectFieldProps) {
  const fieldId = id ?? props.name ?? label;
  return (
    <FieldWrapper label={label} htmlFor={fieldId} error={error} hint={hint}>
      <select id={fieldId} {...fieldA11y(fieldId, error, hint)} className={cn(fieldClassName, 'cursor-pointer', className)} {...props}>
        {children}
      </select>
    </FieldWrapper>
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
  const fieldId = id ?? props.name ?? label;
  return (
    <FieldWrapper label={label} htmlFor={fieldId} error={error} hint={hint}>
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
          aria-pressed={visible}
          aria-controls={fieldId}
          aria-label="Mostrar contraseña"
          className="absolute inset-y-0 right-1 my-1 cursor-pointer rounded-lg px-3 text-xs font-semibold text-primary hover:underline"
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
    </FieldWrapper>
  );
}
