import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Tests del importador de Aronium. Config propia (entorno node) porque la
// config de apps/api corre en el pool de workers de Cloudflare, donde
// `node:sqlite` no existe. Los tests usan el sufijo `.script-test.ts` para que
// la suite principal (`pnpm test`) no los recoja.
export default defineConfig({
  root: path.resolve(import.meta.dirname, '../..'),
  test: {
    environment: 'node',
    include: ['scripts/aronium/**/*.script-test.ts'],
  },
});
