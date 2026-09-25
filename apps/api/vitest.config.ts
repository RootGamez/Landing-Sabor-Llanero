import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// P1.6: config de test SOLO para apps/api (Worker Hono + D1). Usa
// wrangler.test.toml (no wrangler.toml) — ver el comentario de ese archivo
// para el porqué. `TEST_MIGRATIONS` es un binding de solo-test que expone
// las migraciones ya leídas del disco a `test/apply-migrations.ts`.
export default defineConfig(async () => {
  const migrationsPath = path.join(import.meta.dirname, 'migrations');
  const migrations = await readD1Migrations(migrationsPath);

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.test.toml' },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
    },
  };
});
