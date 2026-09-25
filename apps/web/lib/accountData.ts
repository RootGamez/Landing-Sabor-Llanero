/**
 * Fetchers de la cuenta de cliente (P2.8), pensados para pasarse a `useAsync`
 * igual que `lib/menuData.ts`. A diferencia de esos, requieren sesión —
 * `api.ts` adjunta el `Authorization` automáticamente si hay token guardado.
 */
import type { OrderDto, Reward } from "@sabor/shared";
import { api } from "@/lib/api";

/** Catálogo de premios activos (GET /rewards es público, pero el canje sí exige sesión). */
export async function fetchRewards(signal: AbortSignal): Promise<Reward[]> {
  return (await api.get<Reward[]>("/rewards", signal)) ?? [];
}

/** Historial de pedidos propios del cliente logueado. */
export async function fetchMyOrders(signal: AbortSignal): Promise<OrderDto[]> {
  return (await api.get<OrderDto[]>("/orders/me", signal)) ?? [];
}
