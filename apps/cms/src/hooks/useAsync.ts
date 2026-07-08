import { useEffect, useState, useCallback } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
}

/** Hook mínimo de data-fetching: loading/error/data + refetch en cambios de deps o manual. */
export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, loading: true, error: null });
  const [tick, setTick] = useState(0);

  const run = useCallback(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            data: undefined,
            loading: false,
            error: err instanceof Error ? err.message : 'Ocurrió un error',
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => run(), [run, tick]);

  return { ...state, refetch: () => setTick((t) => t + 1) };
}
