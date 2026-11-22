import { useEffect, useRef, useState } from 'react';
import {
  fetchCurrentSession,
  fetchPaymentMethods,
  fetchPendingWebOrders,
  fetchPosCatalog,
  fetchSessionSales,
} from '../lib/posApi';
import { useAsync, type AsyncState } from './useAsync';

const PENDING_ORDERS_POLL_MS = 30_000;

/**
 * Conserva el último dato bueno: si un refetch falla (red caída a mitad de turno)
 * el POS sigue mostrando la caja en vez de reemplazarla por una pantalla de error.
 */
function useKeepLast<T>(state: AsyncState<T>): AsyncState<T> {
  const [last, setLast] = useState<T | undefined>(undefined);
  useEffect(() => {
    if (state.data !== undefined) setLast(state.data);
  }, [state.data]);
  return { ...state, data: state.data !== undefined ? state.data : last };
}

export function usePosCatalog() {
  return useAsync(fetchPosCatalog, []);
}

/** Caja abierta (o `null` si no hay). `data === undefined` significa "aún no cargó". */
export function useCurrentSession() {
  const state = useAsync(fetchCurrentSession, []);
  const kept = useKeepLast(state);
  return { ...kept, refetch: state.refetch };
}

export function usePaymentMethods() {
  return useAsync(fetchPaymentMethods, []);
}

/** Pedidos web por cobrar; se refresca solo cada 30 s mientras la pestaña está visible. */
export function usePendingWebOrders() {
  const state = useAsync(fetchPendingWebOrders, []);
  const kept = useKeepLast(state);
  const refetchRef = useRef(state.refetch);

  useEffect(() => {
    refetchRef.current = state.refetch;
  }, [state.refetch]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refetchRef.current();
    }, PENDING_ORDERS_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return { ...kept, refetch: state.refetch };
}

export function useSessionSales(sessionId: number) {
  return useAsync(() => fetchSessionSales(sessionId), [sessionId]);
}
