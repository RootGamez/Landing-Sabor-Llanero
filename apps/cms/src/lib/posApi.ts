/** Llamadas HTTP del POS (caja, ventas, métodos de pago, menú de mostrador). */
import type {
  CashSessionDetail,
  CreateSaleInput,
  PaginatedResult,
  PaymentMethod,
  PendingWebOrder,
  Sale,
  Size,
} from '@sabor/shared';
import { api } from './api';
import { POS_SECTION_ITEM_LIMIT, buildCatalog, type PosCatalog, type PosMenuSection } from './posCatalog';

export const SESSION_SALES_PAGE_SIZE = 100;

/** Menú de mostrador (canal `pos` + `both`) con precios resueltos y tamaños, ya aplanado. */
export async function fetchPosCatalog(): Promise<PosCatalog> {
  const [sections, sizes] = await Promise.all([
    api.get<PosMenuSection[]>(`/menu-items/sections?channel=pos&limit=${POS_SECTION_ITEM_LIMIT}`),
    api.get<Size[]>('/sizes'),
  ]);
  return buildCatalog(sections, sizes);
}

export const fetchCurrentSession = () => api.get<CashSessionDetail | null>('/cash-sessions/current');

export const openCashSession = (openingCashCents: number) =>
  api.post<CashSessionDetail>('/cash-sessions', { openingCashCents });

export const fetchPaymentMethods = () => api.get<PaymentMethod[]>('/payment-methods');

export const fetchPendingWebOrders = () => api.get<PendingWebOrder[]>('/sales/pending-web-orders');

export const createSale = (input: CreateSaleInput) => api.post<Sale>('/sales', input);

export const fetchSessionSales = (sessionId: number) =>
  api.get<PaginatedResult<Sale>>(`/sales?session_id=${sessionId}&pageSize=${SESSION_SALES_PAGE_SIZE}`);

export const voidSale = (saleId: number, reason: string) =>
  api.post<Sale>(`/sales/${saleId}/void`, { reason });
