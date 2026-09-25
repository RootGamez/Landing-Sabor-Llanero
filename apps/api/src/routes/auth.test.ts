import { env, exports } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../lib/password';
import { hashResetToken } from '../lib/reset-token';
import { signToken } from '../lib/jwt';

const app = exports.default;
const jsonHeaders = { 'Content-Type': 'application/json' };

async function createUser(email: string, password: string): Promise<number> {
  const passwordHash = await hashPassword(password);
  const row = await env.DB.prepare(
    'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?) RETURNING id',
  )
    .bind(email, passwordHash, 'Test User', 'admin')
    .first<{ id: number }>();
  return row!.id;
}

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await createUser('login-test@test.local', 'correcthorsebattery');
  });

  it('acepta credenciales válidas y devuelve un token', async () => {
    const res = await app.fetch('https://example.com/api/auth/login', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ email: 'login-test@test.local', password: 'correcthorsebattery' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };
    expect(typeof body.token).toBe('string');
  });

  it('rechaza una contraseña incorrecta (401)', async () => {
    const res = await app.fetch('https://example.com/api/auth/login', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ email: 'login-test@test.local', password: 'wrongpassword' }),
    });
    expect(res.status).toBe(401);
  });

  it('rechaza un email inexistente con el mismo 401 genérico (anti-enumeración)', async () => {
    const res = await app.fetch('https://example.com/api/auth/login', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ email: 'no-existe@test.local', password: 'cualquiera' }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    // Mismo mensaje que credenciales incorrectas — no debe delatar "no existe la cuenta".
    expect(body.error).toBe('Credenciales inválidas');
  });
});

describe('POST /api/auth/forgot-password + /api/auth/reset-password', () => {
  const EXISTING_EMAIL = 'forgot-test@test.local';

  beforeAll(async () => {
    await createUser(EXISTING_EMAIL, 'oldpassword123');
  });

  it('responde el mismo mensaje exista o no la cuenta (anti-enumeración)', async () => {
    const existingRes = await app.fetch('https://example.com/api/auth/forgot-password', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ email: EXISTING_EMAIL }),
    });
    const missingRes = await app.fetch('https://example.com/api/auth/forgot-password', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ email: 'jamas-existio@test.local' }),
    });
    expect(existingRes.status).toBe(200);
    expect(missingRes.status).toBe(200);
    expect(await existingRes.json()).toEqual(await missingRes.json());
  });

  it('crea un token de recuperación en D1 solo para una cuenta que existe', async () => {
    const userId = await createUser('forgot-token-check@test.local', 'oldpassword123');
    await app.fetch('https://example.com/api/auth/forgot-password', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ email: 'forgot-token-check@test.local' }),
    });
    const row = await env.DB.prepare('SELECT * FROM password_reset_tokens WHERE user_id = ?')
      .bind(userId)
      .first();
    expect(row).not.toBeNull();
  });

  it('un token válido cambia la contraseña e invalida sesiones viejas', async () => {
    const userId = await createUser('reset-valid@test.local', 'oldpassword123');
    const oldToken = await signToken(
      { id: userId, email: 'reset-valid@test.local', role: 'admin' },
      env.JWT_SECRET,
      0,
    );

    // Genera el token de reset directo en D1 (mismo formato que el endpoint real).
    const rawToken = 'raw-token-for-test-reset-valid';
    const tokenHash = await hashResetToken(rawToken);
    // datetime('now', ?) — mismo formato que el INSERT real (routes/auth.ts).
    // Con `new Date().toISOString()` este test habría pasado igual incluso
    // sin el fix del bug de vencimiento (ver el test de "token vencido"), así
    // que no serviría de guarda de regresión real.
    await env.DB.prepare(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, datetime('now', '+30 minutes'))`,
    )
      .bind(userId, tokenHash)
      .run();

    const resetRes = await app.fetch('https://example.com/api/auth/reset-password', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ token: rawToken, newPassword: 'brandnewpassword456' }),
    });
    expect(resetRes.status).toBe(200);

    // La sesión vieja (firmada antes del reset) ya no debe autenticar.
    const meRes = await app.fetch('https://example.com/api/auth/me', {
      headers: { Authorization: `Bearer ${oldToken}` },
    });
    expect(meRes.status).toBe(401);

    // La nueva contraseña sí funciona para loguearse.
    const loginRes = await app.fetch('https://example.com/api/auth/login', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ email: 'reset-valid@test.local', password: 'brandnewpassword456' }),
    });
    expect(loginRes.status).toBe(200);
  });

  it('un token no puede reclamarse dos veces (400 en el segundo intento)', async () => {
    const userId = await createUser('reset-reuse@test.local', 'oldpassword123');
    const rawToken = 'raw-token-for-test-reset-reuse';
    const tokenHash = await hashResetToken(rawToken);
    await env.DB.prepare(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, datetime('now', '+30 minutes'))`,
    )
      .bind(userId, tokenHash)
      .run();

    const first = await app.fetch('https://example.com/api/auth/reset-password', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ token: rawToken, newPassword: 'firstchange123' }),
    });
    expect(first.status).toBe(200);

    const second = await app.fetch('https://example.com/api/auth/reset-password', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ token: rawToken, newPassword: 'secondchange456' }),
    });
    expect(second.status).toBe(400);
  });

  it('un token vencido es rechazado (400 genérico, mismo mensaje que uno inválido)', async () => {
    const userId = await createUser('reset-expired@test.local', 'oldpassword123');
    const rawToken = 'raw-token-for-test-reset-expired';
    const tokenHash = await hashResetToken(rawToken);

    // datetime('now', '-1 minutes'), no `new Date().toISOString()`: mismo
    // formato que usa la propia inserción real (routes/auth.ts) tras el fix
    // de esta fase — un timestamp con 'T'/'Z' compara como texto MAYOR que
    // el de datetime('now') para cualquier hora del mismo día, así que un
    // valor JS-ISO "vencido" en realidad nunca se ve como vencido.
    await env.DB.prepare(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, datetime('now', '-1 minutes'))`,
    )
      .bind(userId, tokenHash)
      .run();

    const expiredRes = await app.fetch('https://example.com/api/auth/reset-password', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ token: rawToken, newPassword: 'whatever12345' }),
    });
    const invalidRes = await app.fetch('https://example.com/api/auth/reset-password', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ token: 'this-token-never-existed', newPassword: 'whatever12345' }),
    });
    expect(expiredRes.status).toBe(400);
    expect(invalidRes.status).toBe(400);
    expect(await expiredRes.json()).toEqual(await invalidRes.json());
  });
});
