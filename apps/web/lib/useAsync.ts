"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Hook genérico de fetch client-side, estilo `useAsync` de Jaw (BLUEPRINT
 * §2.6): sin react-query, con AbortController para cancelar al desmontar y
 * `retry()` para el estado de error. `enabled` permite diferir el fetch
 * (ej. hasta que la sección entre al viewport) para no competir con la
 * carga inicial de la landing.
 */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useAsync<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  enabled = true,
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetcher(controller.signal)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Error inesperado");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // `fetcher` se asume estable (función module-level); incluirla obligaría
    // a memoizar en cada consumidor sin beneficio real.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { data, loading, error, retry };
}
