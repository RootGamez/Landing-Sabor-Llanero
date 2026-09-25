import { env, exports } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../lib/password';
import { signToken } from '../lib/jwt';

const app = exports.default;

/** Crea un usuario directo en D1 (sin pasar por la API) y devuelve su id + un token válido. */
async function createUser(
  email: string,
  role: 'owner' | 'admin',
): Promise<{ id: number; token: string }> {
  const passwordHash = await hashPassword('correcthorsebattery');
  const row = await env.DB.prepare(
    'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?) RETURNING id, token_version',
  )
    .bind(email, passwordHash, 'Test User', role)
    .first<{ id: number; token_version: number }>();
  const token = await signToken({ id: row!.id, email, role }, env.JWT_SECRET, row!.token_version);
  return { id: row!.id, token };
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

describe('routes/users (solo-owner)', () => {
  let ownerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const owner = await createUser('owner-fixture@test.local', 'owner');
    const admin = await createUser('admin-fixture@test.local', 'admin');
    ownerToken = owner.token;
    adminToken = admin.token;
  });

  it('rechaza sin token (401)', async () => {
    const res = await app.fetch('https://example.com/api/users');
    expect(res.status).toBe(401);
  });

  it('rechaza a un admin (solo el owner administra usuarios) (403)', async () => {
    const res = await app.fetch('https://example.com/api/users', { headers: authHeaders(adminToken) });
    expect(res.status).toBe(403);
  });

  it('el owner puede listar usuarios', async () => {
    const res = await app.fetch('https://example.com/api/users', { headers: authHeaders(ownerToken) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ email: string; passwordHash?: string }>;
    expect(body.some((u) => u.email === 'owner-fixture@test.local')).toBe(true);
    // Nunca debe filtrarse el hash de la contraseña en la respuesta pública.
    expect(body[0]?.passwordHash).toBeUndefined();
  });

  it('el owner puede crear un usuario nuevo', async () => {
    const res = await app.fetch('https://example.com/api/users', {
      method: 'POST',
      headers: authHeaders(ownerToken),
      body: JSON.stringify({
        email: 'nuevo-admin@test.local',
        password: 'correcthorsebattery',
        name: 'Nuevo Admin',
        role: 'admin',
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { email: string; role: string };
    expect(body.email).toBe('nuevo-admin@test.local');
    expect(body.role).toBe('admin');
  });

  it('rechaza crear un usuario con un email ya existente (409)', async () => {
    const res = await app.fetch('https://example.com/api/users', {
      method: 'POST',
      headers: authHeaders(ownerToken),
      body: JSON.stringify({
        email: 'owner-fixture@test.local',
        password: 'correcthorsebattery',
        name: 'Duplicado',
        role: 'admin',
      }),
    });
    expect(res.status).toBe(409);
  });

  // El guard de "no degradar/eliminar al último owner" necesita una tabla con
  // EXACTAMENTE un owner para probarse de verdad — acá `beforeAll` ya sembró
  // "owner-fixture" y varios tests de arriba agregan owners propios, así que
  // nunca hay uno solo en este punto. Se prueba en su propio archivo
  // (users-last-owner.test.ts), que arranca con storage vacío (aislamiento
  // por archivo de @cloudflare/vitest-plugin) y controla el conteo exacto.

  it('no permite que un usuario se elimine a sí mismo (403)', async () => {
    const self = await createUser('self-delete@test.local', 'admin');
    const selfToken = self.token;
    const res = await app.fetch(`https://example.com/api/users/${self.id}`, {
      method: 'DELETE',
      headers: authHeaders(selfToken),
    });
    expect(res.status).toBe(403);
  });

  it('permite eliminar a un admin', async () => {
    const disposable = await createUser('disposable-admin@test.local', 'admin');
    const res = await app.fetch(`https://example.com/api/users/${disposable.id}`, {
      method: 'DELETE',
      headers: authHeaders(ownerToken),
    });
    expect(res.status).toBe(204);
  });

  it('cambiar la contraseña de un usuario incrementa token_version (invalida sesiones viejas)', async () => {
    const target = await createUser('token-version-check@test.local', 'admin');
    const res = await app.fetch(`https://example.com/api/users/${target.id}`, {
      method: 'PATCH',
      headers: authHeaders(ownerToken),
      body: JSON.stringify({ password: 'nuevacontrasena123' }),
    });
    expect(res.status).toBe(200);

    // El token viejo (firmado con token_version anterior) ya no debe autenticar.
    const meRes = await app.fetch('https://example.com/api/auth/me', {
      headers: authHeaders(target.token),
    });
    expect(meRes.status).toBe(401);
  });
});
