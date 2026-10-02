"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

interface AccountCheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "name" | "type"> {
  name: string;
  /** Contenido del label (puede incluir enlaces). */
  children: ReactNode;
  error?: string;
}

/**
 * Checkbox de formularios de cuenta (ej. aceptar términos). Mismo contrato de
 * error que `AccountFormField`: `aria-describedby` en vez de `role="alert"`.
 * Un <a> dentro del <label> navega en vez de marcar la casilla, así los
 * enlaces a los documentos no la activan por accidente.
 */
export default function AccountCheckboxField({ name, children, error, ...inputProps }: AccountCheckboxFieldProps) {
  const errorId = error ? `${name}-error` : undefined;

  return (
    <div>
      <label htmlFor={name} className="flex cursor-pointer items-start gap-3 text-sm leading-snug text-ink/80">
        <input
          id={name}
          name={name}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={`mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-2 accent-brand-red ${
            error ? "border-brand-red" : "border-ink/30"
          }`}
          {...inputProps}
        />
        <span>{children}</span>
      </label>
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-brand-red">
          {error}
        </p>
      )}
    </div>
  );
}
