/**
 * Inicia sesión una vez por rol contra la API aislada y guarda el estado del
 * navegador (localStorage del CMS) para que las pruebas no repitan el login.
 * El login por la UI se prueba aparte (flujo del dueño).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { loginAs, closeOpenSession } from './support/api';
import { AUTH_DIR, CMS_URL, storageStatePath, type StaffRole } from './support/env';

const SESSION_KEY = 'sabor-cms-session';
const ROLES: readonly StaffRole[] = ['owner', 'admin', 'cashier'];

async function saveStorageState(role: StaffRole): Promise<void> {
  const { token, user } = await loginAs(role);
  const persisted = JSON.stringify({ state: { token, user }, version: 0 });
  const state = {
    cookies: [],
    origins: [{ origin: CMS_URL, localStorage: [{ name: SESSION_KEY, value: persisted }] }],
  };
  writeFileSync(storageStatePath(role), JSON.stringify(state));
}

export default async function globalSetup(): Promise<void> {
  mkdirSync(AUTH_DIR, { recursive: true });
  await Promise.all(ROLES.map(saveStorageState));
  await closeOpenSession();
}
