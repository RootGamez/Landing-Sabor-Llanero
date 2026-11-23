import { useEffect, useRef, useState } from 'react';
import { fetchTableStatuses } from '../lib/tablesApi';
import { useAsync } from './useAsync';

/** Mozo y caja ven el mismo mapa: se refresca solo cada 12 s y al volver a la pestaña. */
export const TABLES_POLL_MS = 12_000;

/**
 * Llama a `refresh` cada `intervalMs` mientras la pestaña está visible, y al
 * recuperar el foco/visibilidad. `enabled=false` lo pausa (p. ej. con cambios
 * sin guardar en la cuenta de una mesa, para no pisarlos).
 */
export function usePolling(refresh: () => void, intervalMs: number, enabled = true): void {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => {
      if (document.visibilityState === 'visible') refreshRef.current();
    };
    const timer = window.setInterval(tick, intervalMs);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs, enabled]);
}

/** Reloj de pantalla (para "abierta hace 25 min"); se actualiza cada minuto. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * Mapa de mesas con su estado. Conserva el último dato bueno si un refresco
 * falla (el mapa no desaparece por un corte de red), y lo avisa en `error`.
 */
export function useTableStatuses(options: { includeInactive?: boolean; poll?: boolean } = {}) {
  const { includeInactive = false, poll = true } = options;
  const state = useAsync(() => fetchTableStatuses(includeInactive), [includeInactive]);
  const [last, setLast] = useState(state.data);
  useEffect(() => {
    if (state.data !== undefined) setLast(state.data);
  }, [state.data]);
  usePolling(state.refetch, TABLES_POLL_MS, poll);
  return { ...state, data: state.data ?? last };
}
