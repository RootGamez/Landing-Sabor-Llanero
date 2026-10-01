import { WRONG_CURRENT_PASSWORD_MESSAGE } from '@sabor/shared';
import { API_BASE_URL } from './env';
import { useSessionStore } from '../store/sessionStore';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useSessionStore.getState().token;

  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    const message = body.error ?? `Error ${res.status}`;
    // `/auth/login` no necesita sesión; `/auth/change-password` devuelve 401 tanto por "contraseña
    // actual incorrecta" (credenciales de ESE request) como por una sesión muerta: solo la primera
    // no debe cerrar la sesión. Y solo si el token guardado sigue siendo el que viajó en este request
    // (una petición lenta con el token viejo no debe cerrar la sesión nueva tras cambiar la contraseña).
    const isCredentialsError =
      path === '/auth/login' || (path === '/auth/change-password' && message === WRONG_CURRENT_PASSWORD_MESSAGE);
    if (res.status === 401 && !isCredentialsError && useSessionStore.getState().token === token) {
      // Token vencido o inválido: cerrar sesión y forzar re-login.
      useSessionStore.getState().logout();
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
