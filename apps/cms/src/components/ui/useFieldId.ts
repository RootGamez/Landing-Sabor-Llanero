import { useId } from 'react';

/** Id estable del control: el recibido por props o uno generado (para enlazar label/ayuda/error). */
export function useFieldId(id?: string): string {
  const generated = useId();
  return id ?? generated;
}
