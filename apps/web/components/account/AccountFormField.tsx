"use client";

import type { InputHTMLAttributes, Ref } from "react";

interface AccountFormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "name"> {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  /** React 19 permite `ref` como prop normal, sin `forwardRef` — usado para foco programático (ej. AccountProfileSection). */
  ref?: Ref<HTMLInputElement>;
}

/**
 * Input de formulario compartido por login/registro (P2.8). apps/web no tiene
 * un `FormField` propio (a diferencia de apps/cms, que usa shadcn/ui) — este
 * es el primero, así que fija el estilo para el resto de la cuenta.
 */
export default function AccountFormField({ label, name, error, hint, ref, ...inputProps }: AccountFormFieldProps) {
  // Solo referencia un hint que realmente se monta: si un consumidor futuro
  // pasara `hint` y `error` juntos, el `<p id={hintId}>` de abajo no se
  // renderiza (gana el error) y `aria-describedby` no debe apuntar a un id inexistente.
  const hintId = hint && !error ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={name}
        name={name}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-12 w-full rounded-xl border-2 bg-white px-4 text-base text-ink transition-colors duration-200 placeholder:text-ink/40 focus:outline-none ${
          error ? "border-brand-red" : "border-ink/10 focus:border-brand-blue"
        }`}
        {...inputProps}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-ink/60">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-brand-red">
          {error}
        </p>
      )}
    </div>
  );
}
