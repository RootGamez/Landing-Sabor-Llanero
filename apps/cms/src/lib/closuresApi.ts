/** Llamadas HTTP de cierres de caja (cerrar, historial y detalle). */
import type { CashSession, CashSessionDetail, CloseSessionInput, PaginatedResult } from '@sabor/shared';
import { api } from './api';

export const HISTORY_PAGE_SIZE = 20;

export const closeCashSession = (sessionId: number, input: CloseSessionInput) =>
  api.post<CashSessionDetail>(`/cash-sessions/${sessionId}/close`, input);

export const fetchCashSessionDetail = (sessionId: number) =>
  api.get<CashSessionDetail>(`/cash-sessions/${sessionId}`);

export const fetchCashSessions = (page: number) =>
  api.get<PaginatedResult<CashSession>>(`/cash-sessions?page=${page}&pageSize=${HISTORY_PAGE_SIZE}`);
