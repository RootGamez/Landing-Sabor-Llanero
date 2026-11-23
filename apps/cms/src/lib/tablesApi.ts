/** Llamadas HTTP de "Mesas": plano, cuenta de cada mesa, cobro y anulación. */
import type {
  CloseTabInput,
  DiningTab,
  DiningTable,
  DiningTableCreateInput,
  DiningTableStatus,
  DiningTableUpdateInput,
  Sale,
  SaveTabInput,
} from '@sabor/shared';
import { api } from './api';

export const fetchTableStatuses = (includeInactive = false) =>
  api.get<DiningTableStatus[]>(`/tables${includeInactive ? '?all=1' : ''}`);

export const createTable = (input: DiningTableCreateInput) => api.post<DiningTable>('/tables', input);

export const updateTable = (id: number, input: DiningTableUpdateInput) => api.patch<DiningTable>(`/tables/${id}`, input);

export const fetchTableTab = (tableId: number) => api.get<DiningTab | null>(`/tables/${tableId}/tab`);

export const saveTableTab = (tableId: number, input: SaveTabInput) => api.put<DiningTab>(`/tables/${tableId}/tab`, input);

export const closeTableTab = (tableId: number, input: CloseTabInput) =>
  api.post<Sale>(`/tables/${tableId}/tab/close`, input);

export const voidTableTab = (tableId: number, tabId: number, reason: string) =>
  api.post<DiningTab>(`/tables/${tableId}/tab/void`, { tabId, reason });
