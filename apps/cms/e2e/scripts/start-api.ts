/**
 * Levanta la API para los E2E con una base AISLADA (e2e/.state): borra el
 * estado anterior, aplica migraciones, carga el catálogo sintético y los
 * usuarios de prueba, y deja `wrangler dev` corriendo en el puerto de E2E.
 *
 * Seguridad: todo es `--local --persist-to .state` con wrangler.e2e.toml (id de
 * base falso, sin R2 remoto). Nunca se usa `--remote`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { hashPassword } from '../../../api/src/lib/password';
import { API_PORT, E2E_DIR, STATE_DIR, USERS } from '../support/env';

const D1_NAME = 'sabor-llanero-e2e';
const CONFIG = 'wrangler.e2e.toml';
const PERSIST = '.state';
const USERS_SQL = path.join(PERSIST, 'users.sql');
const LOCAL_ONLY = ['--local', '--persist-to', PERSIST, '--config', CONFIG];

/** `wrangler` no exporta su bin: se resuelve desde la carpeta del paquete (apps/cms/node_modules). */
const WRANGLER_BIN = path.resolve(E2E_DIR, '..', 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const WRANGLER_ENV = { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' };

/** Corre wrangler con cwd = e2e/ y rutas relativas (la ruta del repo tiene espacios). */
function runWrangler(args: readonly string[]): void {
  const result = spawnSync(process.execPath, [WRANGLER_BIN, ...args], {
    cwd: E2E_DIR,
    stdio: 'inherit',
    env: WRANGLER_ENV,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function resetState(): void {
  const expected = path.join(E2E_DIR, '.state');
  if (path.resolve(STATE_DIR) !== expected) throw new Error(`Ruta de estado inesperada: ${STATE_DIR}`);
  rmSync(STATE_DIR, { recursive: true, force: true });
  mkdirSync(STATE_DIR, { recursive: true });
}

async function buildUsersSql(): Promise<string> {
  const rows = await Promise.all(
    Object.values(USERS).map(async (user) => {
      const hash = await hashPassword(user.password);
      return `('${user.email}', '${hash}', '${user.name}', '${user.role}')`;
    }),
  );
  return `INSERT INTO users (email, password_hash, name, role) VALUES\n${rows.join(',\n')};\n`;
}

function execSql(file: string): void {
  runWrangler(['d1', 'execute', D1_NAME, ...LOCAL_ONLY, '--file', file]);
}

async function prepareDatabase(): Promise<void> {
  resetState();
  writeFileSync(path.join(E2E_DIR, USERS_SQL), await buildUsersSql());
  runWrangler(['d1', 'migrations', 'apply', D1_NAME, ...LOCAL_ONLY]);
  execSql('fixtures/e2e-seed.sql');
  execSql(USERS_SQL);
}

function serve(): void {
  const args = ['dev', '--config', CONFIG, '--persist-to', PERSIST, '--port', String(API_PORT), '--ip', '127.0.0.1'];
  const child = spawn(process.execPath, [WRANGLER_BIN, ...args], {
    cwd: E2E_DIR,
    stdio: 'inherit',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  const stop = () => child.kill();
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  child.on('exit', (code) => process.exit(code ?? 0));
}

await prepareDatabase();
serve();
