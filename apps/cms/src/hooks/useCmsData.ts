import type {
  CollectionWithItems,
  LoyaltyConfig,
  OrderDto,
  OrderStatus,
  PaginatedResult,
  RaffleDraw,
  RaffleEntry,
  Reward,
  Size,
  User,
  WhatsappConfig,
} from '@sabor/shared';
import type { CategoryWithPrices, MenuItemDetailAdmin, MenuItemWithCover } from '../lib/adminTypes';
import { api } from '../lib/api';
import { useAsync } from './useAsync';

export function useCategories() {
  return useAsync<CategoryWithPrices[]>(() => api.get('/categories'), []);
}

export function useSizes() {
  return useAsync<Size[]>(() => api.get('/sizes'), []);
}

export function useMenuItems(params: { categoryId?: number; search?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params.categoryId) query.set('categoryId', String(params.categoryId));
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  const qs = query.toString();

  return useAsync<PaginatedResult<MenuItemWithCover>>(
    () => api.get(`/menu-items${qs ? `?${qs}` : ''}`),
    [params.categoryId, params.search, params.page],
  );
}

export function useMenuItemDetail(idOrSlug: string | undefined) {
  return useAsync<MenuItemDetailAdmin>(() => {
    if (!idOrSlug) return Promise.reject(new Error('id requerido'));
    return api.get(`/menu-items/${idOrSlug}`);
  }, [idOrSlug]);
}

export function useWhatsappConfig() {
  return useAsync<WhatsappConfig>(() => api.get('/whatsapp'), []);
}

export function useUsers() {
  return useAsync<User[]>(() => api.get('/users'), []);
}

/** Todas las colecciones de merchandising (incluidas inactivas e ítems inactivos), para el CMS. */
export function useCollections() {
  return useAsync<CollectionWithItems[]>(() => api.get('/collections/all'), []);
}

export function useOrders(params: { status?: OrderStatus; page?: number }) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  const qs = query.toString();

  return useAsync<PaginatedResult<OrderDto>>(
    () => api.get(`/orders${qs ? `?${qs}` : ''}`),
    [params.status, params.page],
  );
}

/** Todos los premios (incluidos inactivos), para el CMS — mismo criterio que useCollections. */
export function useRewards() {
  return useAsync<Reward[]>(() => api.get('/rewards'), []);
}

export function useLoyaltyConfig() {
  return useAsync<LoyaltyConfig>(() => api.get('/loyalty-config'), []);
}

export function useRaffleEntries(period: string) {
  return useAsync<PaginatedResult<RaffleEntry>>(
    () => api.get(`/raffle/entries?period=${encodeURIComponent(period)}&pageSize=100`),
    [period],
  );
}

export function useRaffleDraws() {
  return useAsync<PaginatedResult<RaffleDraw>>(() => api.get('/raffle/draws?pageSize=100'), []);
}
