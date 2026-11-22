import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { API_PORT, API_URL, CMS_PORT, CMS_URL, E2E_DIR } from './support/env';

const CMS_DIR = path.resolve(E2E_DIR, '..');

/**
 * E2E del CMS (back-office). Todo corre en local y aislado:
 * - API: wrangler dev con persistencia propia en e2e/.state (ver scripts/start-api.ts).
 * - CMS: Vite en un puerto libre (no 5174/5175) apuntando a esa API.
 * Una sola caja puede estar abierta a la vez, así que las pruebas corren en serie.
 * Usa el Chrome instalado (como el proyecto hermano Don Pilón): no descarga navegadores.
 */
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const MOBILE_SPEC = /06-movil\.spec\.ts/;

export default defineConfig({
  testDir: './tests',
  outputDir: './.results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { outputFolder: './.report', open: 'never' }]],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: CMS_URL,
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
  },
  projects: [
    {
      name: 'escritorio',
      testIgnore: MOBILE_SPEC,
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1366, height: 800 } },
    },
    {
      name: 'movil',
      testMatch: MOBILE_SPEC,
      use: { ...devices['Pixel 7'], channel: 'chrome', viewport: MOBILE_VIEWPORT },
    },
  ],
  webServer: [
    {
      command: 'pnpm exec tsx e2e/scripts/start-api.ts',
      cwd: CMS_DIR,
      url: `${API_URL}/api/sizes`,
      reuseExistingServer: false,
      timeout: 240_000,
      stdout: 'pipe',
      stderr: 'pipe',
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
    {
      command: `pnpm exec vite --host 127.0.0.1 --port ${CMS_PORT} --strictPort`,
      cwd: CMS_DIR,
      url: CMS_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_BASE_URL: API_URL },
    },
  ],
});

// Evita que un cambio accidental de puerto reutilice el de desarrollo.
if ([8787, 5174, 5175].includes(API_PORT) || [8787, 5174, 5175].includes(CMS_PORT)) {
  throw new Error('Los puertos de E2E no pueden coincidir con los de desarrollo.');
}
