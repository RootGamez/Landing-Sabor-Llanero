import { useState } from 'react';
import { ApiError } from '../lib/api';
import { toastError } from '../store/toastStore';

/** Wrapper de mutaciones (POST/PATCH/PUT/DELETE) con estado de loading y manejo de error uniforme. */
export function useMutation<Args extends unknown[], T>(fn: (...args: Args) => Promise<T>) {
  const [loading, setLoading] = useState(false);

  async function mutate(...args: Args): Promise<T | undefined> {
    setLoading(true);
    try {
      return await fn(...args);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Ocurrió un error inesperado';
      toastError(message);
      return undefined;
    } finally {
      setLoading(false);
    }
  }

  return { mutate, loading };
}
