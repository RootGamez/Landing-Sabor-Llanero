import { fetchCashSessionDetail, fetchCashSessions } from '../lib/closuresApi';
import { useAsync } from './useAsync';

/** Detalle de una sesión (snapshot si está cerrada). Con `sessionId = null` no pide nada. */
export function useCashSessionDetail(sessionId: number | null) {
  return useAsync(
    () => (sessionId === null ? Promise.resolve(null) : fetchCashSessionDetail(sessionId)),
    [sessionId],
  );
}

/** Historial paginado de cierres (solo owner/admin; el cajero recibe 403). */
export function useCashSessionHistory(page: number) {
  return useAsync(() => fetchCashSessions(page), [page]);
}
