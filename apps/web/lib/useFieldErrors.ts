"use client";

import { useState } from "react";

/**
 * Errores de formulario con "touched": un campo muestra su error al salir de él
 * (`touch`) o tras intentar enviar (`validate`). Las claves deben coincidir con
 * el `name` de cada input (que es también su `id`) para poder enfocar el
 * primero inválido. `errors` se recalcula en cada render desde el estado del form.
 */
export function useFieldErrors<K extends string>(errors: Record<K, string | null>) {
  const [touched, setTouched] = useState<Partial<Record<K, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const error = (field: K): string | undefined => (submitted || touched[field] ? (errors[field] ?? undefined) : undefined);

  const touch = (field: K): void => setTouched((previous) => (previous[field] ? previous : { ...previous, [field]: true }));

  /** Marca todos los campos como vistos y enfoca el primero inválido. Devuelve true si todo es válido. */
  const validate = (): boolean => {
    setSubmitted(true);
    const firstInvalid = (Object.keys(errors) as K[]).find((field) => errors[field]);
    if (firstInvalid) document.getElementById(firstInvalid)?.focus();
    return !firstInvalid;
  };

  const reset = (): void => {
    setTouched({});
    setSubmitted(false);
  };

  return { error, touch, validate, reset };
}
