/**
 * Cliente HTTP hacia apps/api (Worker Hono), mismo patrón que Jaw-Project
 * (BLUEPRINT §2.6): `request<T>()` prefija la base de la API, lanza
 * `ApiError(status, message)` en respuestas no-2xx (leyendo `body.error`),
 * y devuelve `undefined` cuando el body viene vacío (204/205, o 201 sin
 * contenido como `POST /api/events`). El sitio es `output: "export"` (sin
 * SSR), así que todas las llamadas ocurren client-side en el navegador.
 */

/** Base pública de la API. Fallback razonable a `wrangler dev` local (:8787). */
export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8787";

/**
 * Sesión de cliente (P2.8): el token vive en `localStorage`, leído acá mismo
 * (no importado desde `lib/customerAuth.tsx`) para evitar un import circular
 * — `customerAuth.tsx` llama a `api.*` y necesita estas 3 funciones; `api.ts`
 * solo necesita leer el token en cada request.
 */
const CUSTOMER_TOKEN_KEY = "sabor-llanero-customer-token";

export function getCustomerToken(): string | null {
  try {
    return window.localStorage.getItem(CUSTOMER_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setCustomerToken(token: string): void {
  try {
    window.localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  } catch {
    // localStorage bloqueado: la sesión igual funciona en memoria durante la pestaña actual.
  }
}

export function clearCustomerToken(): void {
  try {
    window.localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  } catch {
    // no-op
  }
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

function buildHeaders(hasBody: boolean): Record<string, string> {
  const token = getCustomerToken();
  return {
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // el body no era JSON (ej. 502 de un proxy) — se usa el fallback de abajo
  }
  return `Error ${response.status}`;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T | undefined> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    method: options.method ?? "GET",
    headers: buildHeaders(options.body !== undefined),
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  // `/customers/login` y `/customers/register` excluidos a propósito: un 401
  // ahí es por credenciales inválidas EN ESE REQUEST, no por el token ya
  // guardado (que igual viaja en el header si había una sesión activa desde
  // antes, ej. alguien logueado que abre /cuenta/login/ por bookmark y escribe
  // mal la contraseña) — limpiarlo ahí cerraría una sesión válida sin motivo.
  const AUTH_ENDPOINTS_WITH_OWN_401 = ["/customers/login", "/customers/register"];
  if (response.status === 401 && !AUTH_ENDPOINTS_WITH_OWN_401.includes(path)) {
    // Token de cliente vencido/inválido en cualquier otro endpoint: se limpia
    // acá mismo para no seguir reenviándolo. `customerAuth.tsx` ve
    // `customer: null` en su próximo `refresh()`/remount — no hace falta un
    // mecanismo reactivo más elaborado para el volumen de esta pizzería.
    clearCustomerToken();
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  // Algunas respuestas 2xx no traen body (204/205, o 201 de POST /api/events):
  // response.json() lanzaría SyntaxError sobre un body vacío.
  const text = await response.text();
  if (text === "") return undefined;

  return JSON.parse(text) as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal): Promise<T | undefined> => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown): Promise<T | undefined> => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown): Promise<T | undefined> => request<T>(path, { method: "PATCH", body }),
};

/** URL pública de un archivo de media servido por la API (GET /api/media/:key). */
export function mediaUrl(key: string): string {
  return `${API_BASE_URL}/api/media/${key}`;
}
