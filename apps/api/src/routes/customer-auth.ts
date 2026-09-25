import { Hono } from 'hono';
import {
  changePasswordSchema,
  customerLoginSchema,
  customerRegisterSchema,
  updateCustomerProfileSchema,
  type ChangePasswordResponse,
  type CustomerLoginResponse,
} from '@sabor/shared';
import type { AppEnv } from '../env';
import type { CustomerRow } from '../db/rows';
import { mapCustomer } from '../db/rows';
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from '../lib/password';
import { signCustomerToken } from '../lib/jwt';
import { conflict, unauthorized } from '../lib/http-error';
import { requireCustomerAuth } from '../middleware/customer-auth';
import { rateLimit } from '../middleware/rate-limit';
import { parseBody } from '../lib/validate';

export const customerAuthRoutes = new Hono<AppEnv>();

// Alta de cuenta (self-service, a diferencia de /users que solo crea el owner):
// devuelve token igual que /login para no forzar un segundo request.
// A propósito NO es anti-enumeración como /login o /forgot-password: acá
// revelar "ya existe una cuenta con ese email" es el trade-off de UX estándar
// de cualquier registro self-service (el usuario necesita saber que puede
// hacer login en vez de registrarse de nuevo), y el costo de la fuga es bajo
// (alta de cliente de una pizzería, no una cuenta de alto valor).
customerAuthRoutes.post('/register', rateLimit((env) => env.CUSTOMER_AUTH_LIMITER), async (c) => {
  const body = await parseBody(c, customerRegisterSchema);
  const email = body.email.toLowerCase();

  const existing = await c.env.DB.prepare('SELECT id FROM customers WHERE email = ?')
    .bind(email)
    .first();
  if (existing) throw conflict('Ya existe una cuenta con ese email');

  const passwordHash = await hashPassword(body.password);
  const row = await c.env.DB.prepare(
    'INSERT INTO customers (email, phone, password_hash, name) VALUES (?, ?, ?, ?) RETURNING *',
  )
    .bind(email, body.phone, passwordHash, body.name)
    .first<CustomerRow>();

  const token = await signCustomerToken(
    { customerId: row!.id, email: row!.email },
    c.env.CUSTOMER_JWT_SECRET,
    row!.token_version,
  );
  return c.json<CustomerLoginResponse>({ token }, 201);
});

// Rate limit por IP para frenar fuerza bruta / credential stuffing, igual que /auth/login.
customerAuthRoutes.post('/login', rateLimit((env) => env.CUSTOMER_AUTH_LIMITER), async (c) => {
  const body = await parseBody(c, customerLoginSchema);
  const email = body.email.toLowerCase();

  const row = await c.env.DB.prepare('SELECT * FROM customers WHERE email = ?')
    .bind(email)
    .first<CustomerRow>();

  // Anti-enumeración: mismo hash dummy que /auth/login si el email no existe.
  const passwordHash = row?.password_hash ?? DUMMY_PASSWORD_HASH;
  const valid = await verifyPassword(body.password, passwordHash);
  if (!row || !valid) throw unauthorized('Credenciales inválidas');

  await c.env.DB.prepare("UPDATE customers SET last_login_at = datetime('now') WHERE id = ?")
    .bind(row.id)
    .run();

  const token = await signCustomerToken(
    { customerId: row.id, email: row.email },
    c.env.CUSTOMER_JWT_SECRET,
    row.token_version,
  );
  return c.json<CustomerLoginResponse>({ token });
});

customerAuthRoutes.get('/me', requireCustomerAuth, async (c) => {
  const authCustomer = c.get('customer');
  const row = await c.env.DB.prepare('SELECT * FROM customers WHERE id = ?')
    .bind(authCustomer.id)
    .first<CustomerRow>();
  if (!row) throw unauthorized();
  return c.json(mapCustomer(row));
});

/**
 * Perfil propio: nombre y teléfono. Email y contraseña van por endpoints
 * separados. El merge de campos opcionales es COALESCE dentro del propio
 * UPDATE, no un SELECT previo + merge en app code: dos PATCH concurrentes
 * (ej. dos pestañas, uno cambia name y otro phone) no deben pisarse el
 * cambio del otro con un valor leído antes de que el otro commitee
 * (lost update) — mismo criterio que el resto del repo evita TOCTOU
 * metiendo la lógica dentro del WHERE/SET, no en un SELECT previo.
 */
customerAuthRoutes.patch('/me', requireCustomerAuth, async (c) => {
  const authCustomer = c.get('customer');
  const body = await parseBody(c, updateCustomerProfileSchema);

  const row = await c.env.DB.prepare(
    'UPDATE customers SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ? RETURNING *',
  )
    .bind(body.name ?? null, body.phone ?? null, authCustomer.id)
    .first<CustomerRow>();
  if (!row) throw unauthorized();
  return c.json(mapCustomer(row));
});

/**
 * Cambio de contraseña propio, mismo criterio que `/auth/change-password`:
 * exige la contraseña actual, comparte rate limit, incrementa token_version
 * (revoca sesiones viejas) y devuelve un token nuevo para no cortar la sesión actual.
 */
customerAuthRoutes.post(
  '/change-password',
  rateLimit((env) => env.CUSTOMER_AUTH_LIMITER),
  requireCustomerAuth,
  async (c) => {
    const authCustomer = c.get('customer');
    const body = await parseBody(c, changePasswordSchema);

    const row = await c.env.DB.prepare('SELECT * FROM customers WHERE id = ?')
      .bind(authCustomer.id)
      .first<CustomerRow>();
    if (!row) throw unauthorized();

    const valid = await verifyPassword(body.currentPassword, row.password_hash);
    if (!valid) throw unauthorized('La contraseña actual es incorrecta');

    const passwordHash = await hashPassword(body.newPassword);
    const updated = await c.env.DB.prepare(
      'UPDATE customers SET password_hash = ?, token_version = token_version + 1 WHERE id = ? RETURNING *',
    )
      .bind(passwordHash, authCustomer.id)
      .first<CustomerRow>();

    const token = await signCustomerToken(
      { customerId: row.id, email: row.email },
      c.env.CUSTOMER_JWT_SECRET,
      updated!.token_version,
    );
    return c.json<ChangePasswordResponse>({ token });
  },
);
