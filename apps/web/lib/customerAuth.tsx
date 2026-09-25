"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Customer, CustomerLoginResponse, CustomerRegisterInput } from "@sabor/shared";
import { api, ApiError, clearCustomerToken, getCustomerToken, setCustomerToken } from "@/lib/api";

/**
 * Sesión de cliente final (P2.8) — Context, mismo patrón que `lib/lang.tsx`/
 * `lib/cart.tsx`: sin Zustand (apps/web no lo tiene y no lo necesita). El
 * token vive en `localStorage` (leído/escrito en `lib/api.ts` para no crear
 * un import circular); acá solo se orquesta login/registro/logout y se
 * mantiene el perfil (`Customer`) en memoria.
 *
 * JWT completamente separado del de `users` (staff) — ver "Seguridad: JWT de
 * cliente separado" en PLAN_IMPLEMENTACION.md. Este contexto nunca toca rutas
 * de staff ni comparte almacenamiento con ellas.
 */
interface CustomerAuthContextValue {
  customer: Customer | null;
  /** true mientras se resuelve la sesión al montar (token guardado → GET /customers/me). */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: CustomerRegisterInput) => Promise<void>;
  logout: () => void;
  /** Vuelve a pedir el perfil (ej. tras confirmar un pedido, para refrescar el saldo de puntos). */
  refresh: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  // Guarda de "última solicitud vigente" (mismo criterio que useAsync, con un
  // contador en vez de AbortController): dos `loadMe()` casi simultáneas
  // (ej. dos canjes rápidos, cada uno llamando `refresh()`) pueden resolver
  // en cualquier orden — sin esto, la respuesta más vieja podía pisar el
  // `customer` con datos desactualizados llegando después de la más nueva.
  const requestIdRef = useRef(0);

  const loadMe = useCallback(async (): Promise<void> => {
    const requestId = ++requestIdRef.current;
    if (!getCustomerToken()) {
      if (requestId === requestIdRef.current) setCustomer(null);
      return;
    }
    try {
      const me = await api.get<Customer>("/customers/me");
      if (requestId === requestIdRef.current) setCustomer(me ?? null);
    } catch (err) {
      // Solo un 401 real implica sesión inválida (y `lib/api.ts` ya limpió el
      // token). Un error transitorio de red/servidor no debe desloguear a
      // alguien que recién guardó un cambio con éxito — se mantiene el
      // `customer` actual en vez de tirarlo a `null`.
      if (requestId === requestIdRef.current && err instanceof ApiError && err.status === 401) {
        setCustomer(null);
      }
    }
  }, []);

  useEffect(() => {
    loadMe().finally(() => setLoading(false));
  }, [loadMe]);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const res = await api.post<CustomerLoginResponse>("/customers/login", { email, password });
      if (!res) throw new ApiError(500, "Respuesta inesperada del servidor");
      setCustomerToken(res.token);
      await loadMe();
    },
    [loadMe],
  );

  const register = useCallback(
    async (input: CustomerRegisterInput): Promise<void> => {
      const res = await api.post<CustomerLoginResponse>("/customers/register", input);
      if (!res) throw new ApiError(500, "Respuesta inesperada del servidor");
      setCustomerToken(res.token);
      await loadMe();
    },
    [loadMe],
  );

  const logout = useCallback((): void => {
    clearCustomerToken();
    setCustomer(null);
  }, []);

  const value = useMemo<CustomerAuthContextValue>(
    () => ({ customer, loading, login, register, logout, refresh: loadMe }),
    [customer, loading, login, register, logout, loadMe],
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth(): CustomerAuthContextValue {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth debe usarse dentro de <CustomerAuthProvider>");
  return ctx;
}
