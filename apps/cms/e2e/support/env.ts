import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Carpeta `apps/cms/e2e`. */
export const E2E_DIR = path.resolve(here, '..');
/** Persistencia AISLADA de Miniflare (gitignored): nunca la D1 local del dueño. */
export const STATE_DIR = path.join(E2E_DIR, '.state');
export const AUTH_DIR = path.join(STATE_DIR, 'auth');

/**
 * Puertos distintos de los de desarrollo (8787 api, 5174 cms, 5175 reservado). Por defecto fijos;
 * `E2E_API_PORT` / `E2E_CMS_PORT` permiten moverlos si otro proceso local ya ocupa uno.
 */
export const API_PORT = Number(process.env.E2E_API_PORT ?? 8791);
export const CMS_PORT = Number(process.env.E2E_CMS_PORT ?? 5193);
export const API_URL = `http://127.0.0.1:${API_PORT}`;
export const CMS_URL = `http://127.0.0.1:${CMS_PORT}`;

export type StaffRole = 'owner' | 'admin' | 'cashier';

export interface E2eUser {
  role: StaffRole;
  email: string;
  password: string;
  name: string;
}

/** Usuarios de prueba (contraseñas de juguete; solo existen en la base aislada). */
export const USERS: Readonly<Record<StaffRole, E2eUser>> = {
  owner: { role: 'owner', email: 'dueno@e2e.test', password: 'e2e-clave-dueno-1', name: 'Dueño E2E' },
  admin: { role: 'admin', email: 'admin@e2e.test', password: 'e2e-clave-admin-1', name: 'Admin E2E' },
  cashier: { role: 'cashier', email: 'cajero@e2e.test', password: 'e2e-clave-cajero-1', name: 'Cajero E2E' },
};

/** Ids del catálogo sintético (fixtures/e2e-seed.sql). */
export const CATALOG = {
  sizeMediana: 1,
  sizeGrande: 2,
  pizzaDemo: 1,
  gaseosaDemo: 2,
  aguaDemo: 3,
  tequenosDemo: 4,
  portionMediaDocena: 3,
  portionDocena: 4,
  portionDocenaYMedia: 5,
} as const;

export function storageStatePath(role: StaffRole): string {
  return path.join(AUTH_DIR, `${role}.json`);
}
