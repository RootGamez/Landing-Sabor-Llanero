/**
 * Cliente HTTP mínimo contra la API de E2E (puerto aislado). Sirve para
 * preparar o limpiar estado entre pruebas sin pasar por la UI.
 */
import { API_URL, CATALOG, USERS, type StaffRole } from './env';

interface LoginBody {
  token: string;
}

interface MeBody {
  id: number;
  email: string;
  name: string;
  role: StaffRole;
}

interface SessionBody {
  id: number;
}

export interface StaffSession {
  token: string;
  user: MeBody;
}

async function call<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

const post = <T>(path: string, token: string | null, body: unknown): Promise<T> =>
  call<T>(path, token, { method: 'POST', body: JSON.stringify(body) });

export async function loginAs(role: StaffRole): Promise<StaffSession> {
  const { email, password } = USERS[role];
  const { token } = await post<LoginBody>('/auth/login', null, { email, password });
  const user = await call<MeBody>('/auth/me', token);
  return { token, user };
}

/** Cierra la caja abierta (si hay) sin cuadrar: deja el sistema listo para la próxima prueba. */
export async function closeOpenSession(): Promise<void> {
  const { token } = await loginAs('owner');
  const current = await call<SessionBody | null>('/cash-sessions/current', token);
  if (current) await post(`/cash-sessions/${current.id}/close`, token, { reconcile: false });
}

/** Abre una caja, registra una venta de la Pizza Demo mediana (S/ 20.00) y la cierra. Devuelve su total en céntimos. */
export async function seedClosedDayWithSale(): Promise<number> {
  const { token } = await loginAs('owner');
  const session = await post<SessionBody>('/cash-sessions', token, { openingCashCents: 5_000 });
  await post('/sales', token, {
    clientUuid: crypto.randomUUID(),
    items: [{ itemId: CATALOG.pizzaDemo, sizeId: CATALOG.sizeMediana, quantity: 1 }],
    paymentMethod: 'yape',
  });
  await post(`/cash-sessions/${session.id}/close`, token, { reconcile: false });
  return 2_000;
}
