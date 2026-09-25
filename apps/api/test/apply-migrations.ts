import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

// Corre antes de cada archivo de test (fuera del aislamiento de storage por
// archivo, y puede ejecutarse más de una vez — `applyD1Migrations` solo
// aplica las que faltan, así que es seguro).
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
