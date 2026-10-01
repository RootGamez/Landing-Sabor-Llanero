import { env, exports } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../lib/password';
import { hashResetToken } from '../lib/reset-token';
import { signCustomerToken } from '../lib/jwt';
import { WRONG_CURRENT_PASSWORD_MESSAGE } from '@sabor/shared';

const app = exports.default;
const jsonHeaders = { 'Content-Type': 'application/json' };

async function createCustomer(email: string, password: string): Promise<number> {
  const passwordHash = await hashPassword(password);
  const row = await env.DB.prepare(
    "INSERT INTO customers (email, phone, password_hash, name) VALUES (?, '3001234567', ?, 'Cliente Test') RETURNING id",
  )
    .bind(email, passwordHash)
    .first<{ id: number }>();
  return row!.id;
}

function post(path: string, body: unknown): Promise<Response> {
  return app.fetch(`https://example.com/api/customers/${path}`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
}

async function insertResetToken(customerId: number, rawToken: string, expiresModifier: string) {
  await env.DB.prepare(
    `INSERT INTO customer_password_reset_tokens (customer_id, token_hash, expires_at)
     VALUES (?, ?, datetime('now', ?))`,
  )
    .bind(customerId, await hashResetToken(rawToken), expiresModifier)
    .run();
}

describe('POST /api/customers/forgot-password + /api/customers/reset-password', () => {
  const EXISTING_EMAIL = 'customer-forgot@test.local';

  beforeAll(async () => {
    await createCustomer(EXISTING_EMAIL, 'oldpassword123');
  });

  it('responde el mismo mensaje exista o no la cuenta (anti-enumeración)', async () => {
    const existingRes = await post('forgot-password', { email: EXISTING_EMAIL });
    const missingRes = await post('forgot-password', { email: 'jamas-existio@test.local' });

    expect(existingRes.status).toBe(200);
    expect(missingRes.status).toBe(200);
    expect(await existingRes.json()).toEqual(await missingRes.json());
  });

  it('crea un token de recuperación solo para un cliente que existe', async () => {
    await createCustomer('customer-forgot-token@test.local', 'oldpassword123');
    const countTokens = async () =>
      (await env.DB.prepare('SELECT COUNT(*) AS n FROM customer_password_reset_tokens').first<{ n: number }>())!
        .n;
    const before = await countTokens();

    await post('forgot-password', { email: 'nadie-token@test.local' });
    expect(await countTokens()).toBe(before);

    await post('forgot-password', { email: 'customer-forgot-token@test.local' });
    expect(await countTokens()).toBe(before + 1);
  });

  it('rechaza un email con formato inválido con 400', async () => {
    const res = await post('forgot-password', { email: 'no-es-email' });

    expect(res.status).toBe(400);
  });

  it('un token válido cambia la contraseña e invalida las sesiones viejas', async () => {
    const customerId = await createCustomer('customer-reset-valid@test.local', 'oldpassword123');
    const oldSession = await signCustomerToken(
      { customerId, email: 'customer-reset-valid@test.local' },
      env.CUSTOMER_JWT_SECRET,
      0,
    );
    await insertResetToken(customerId, 'raw-customer-token-valid', '+30 minutes');

    const resetRes = await post('reset-password', {
      token: 'raw-customer-token-valid',
      newPassword: 'brandnewpassword456',
    });
    expect(resetRes.status).toBe(200);

    const meRes = await app.fetch('https://example.com/api/customers/me', {
      headers: { Authorization: `Bearer ${oldSession}` },
    });
    expect(meRes.status).toBe(401);

    const loginRes = await post('login', {
      email: 'customer-reset-valid@test.local',
      password: 'brandnewpassword456',
    });
    expect(loginRes.status).toBe(200);
  });

  it('un token no puede reclamarse dos veces (400 en el segundo intento)', async () => {
    const customerId = await createCustomer('customer-reset-reuse@test.local', 'oldpassword123');
    await insertResetToken(customerId, 'raw-customer-token-reuse', '+30 minutes');

    const first = await post('reset-password', { token: 'raw-customer-token-reuse', newPassword: 'firstchange123' });
    const second = await post('reset-password', { token: 'raw-customer-token-reuse', newPassword: 'secondchange456' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
  });

  it('un token vencido o inventado da el mismo 400 genérico', async () => {
    const customerId = await createCustomer('customer-reset-expired@test.local', 'oldpassword123');
    await insertResetToken(customerId, 'raw-customer-token-expired', '-1 minutes');

    const expiredRes = await post('reset-password', {
      token: 'raw-customer-token-expired',
      newPassword: 'whatever12345',
    });
    const invalidRes = await post('reset-password', {
      token: 'this-token-never-existed',
      newPassword: 'whatever12345',
    });

    expect(expiredRes.status).toBe(400);
    expect(invalidRes.status).toBe(400);
    expect(await expiredRes.json()).toEqual(await invalidRes.json());
  });

  it('rechaza una contraseña nueva demasiado corta con 400, sin consumir el token', async () => {
    const customerId = await createCustomer('customer-reset-weak@test.local', 'oldpassword123');
    await insertResetToken(customerId, 'raw-customer-token-weak', '+30 minutes');

    const weak = await post('reset-password', { token: 'raw-customer-token-weak', newPassword: 'corta' });
    const ok = await post('reset-password', { token: 'raw-customer-token-weak', newPassword: 'longenough123' });

    expect(weak.status).toBe(400);
    expect(ok.status).toBe(200);
  });
});

describe('POST /api/customers/register: límites de entrada', () => {
  const base = { name: 'Ana Pérez', email: 'limits@test.local', phone: '987654321', password: 'validpassword1' };

  it.each([
    ['nombre demasiado largo', 'name', { name: `${'a'.repeat(30)} ${'b'.repeat(40)}` }],
    ['email con formato inválido', 'email', { email: 'no-es-un-email' }],
    ['email demasiado largo', 'email', { email: `${'a'.repeat(250)}@example.com` }],
    ['celular demasiado largo', 'phone', { phone: '9'.repeat(31) }],
    ['contraseña demasiado corta', 'password', { password: 'corta' }],
    ['nombre de solo espacios', 'name', { name: '     ' }],
    ['nombre con caracteres de dirección de texto', 'name', { name: 'Ana ‮Pérez' }],
    ['celular con letras', 'phone', { phone: '987abc321' }],
  ])('rechaza %s con 400 indicando el campo %s', async (_label, field, override) => {
    const res = await post('register', { ...base, ...override });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(new RegExp(`^${field}:`));
  });
});

describe('POST /api/customers/change-password', () => {
  it('una contraseña actual incorrecta da 401 con el mensaje compartido (los clientes lo usan para no cerrar la sesión)', async () => {
    const customerId = await createCustomer('customer-wrong-current@test.local', 'currentpassword1');
    const session = await signCustomerToken(
      { customerId, email: 'customer-wrong-current@test.local' },
      env.CUSTOMER_JWT_SECRET,
      0,
    );

    const res = await app.fetch('https://example.com/api/customers/change-password', {
      method: 'POST',
      headers: { ...jsonHeaders, Authorization: `Bearer ${session}` },
      body: JSON.stringify({ currentPassword: 'equivocada12345', newPassword: 'brandnewpassword2' }),
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: WRONG_CURRENT_PASSWORD_MESSAGE });
  });

  it('rechaza una nueva igual a la actual (400) y acepta una distinta devolviendo un token nuevo', async () => {
    const customerId = await createCustomer('customer-change@test.local', 'currentpassword1');
    const session = await signCustomerToken(
      { customerId, email: 'customer-change@test.local' },
      env.CUSTOMER_JWT_SECRET,
      0,
    );
    const change = (currentPassword: string, newPassword: string) =>
      app.fetch('https://example.com/api/customers/change-password', {
        method: 'POST',
        headers: { ...jsonHeaders, Authorization: `Bearer ${session}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

    expect((await change('currentpassword1', 'currentpassword1')).status).toBe(400);
    const ok = await change('currentpassword1', 'brandnewpassword2');
    expect(ok.status).toBe(200);
    expect(await ok.json()).toHaveProperty('token');
  });
});
