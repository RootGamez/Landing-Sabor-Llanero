import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emailRequestSchema } from '@sabor/shared';
import { hashPassword, verifyPassword } from './password';
import {
  requestPasswordReset,
  resetPassword,
  MAX_LIVE_RESET_TOKENS,
  RESET_REQUEST_COOLDOWN_SECONDS,
  type ResetAudience,
  type ResetEnv,
} from './password-reset';

const resetEnv: ResetEnv = {
  DB: env.DB,
  MAIL_LAMBDA_URL: 'https://mailer.example.test/',
  MAIL_LAMBDA_SECRET: 'test-secret',
  WEB_ORIGIN: 'https://saborllanero.online,https://www.saborllanero.online',
  CMS_ORIGIN: 'https://cms.saborllanero.online',
};

const TABLES: Record<ResetAudience, { accounts: string; tokens: string; fk: string }> = {
  staff: { accounts: 'users', tokens: 'password_reset_tokens', fk: 'user_id' },
  customer: { accounts: 'customers', tokens: 'customer_password_reset_tokens', fk: 'customer_id' },
};

let counter = 0;

async function createAccount(audience: ResetAudience, password = 'oldpassword123') {
  const email = `reset-helper-${audience}-${++counter}@test.local`;
  const passwordHash = await hashPassword(password);
  const row =
    audience === 'staff'
      ? await env.DB.prepare(
          "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, 'T', 'admin') RETURNING id",
        )
          .bind(email, passwordHash)
          .first<{ id: number }>()
      : await env.DB.prepare(
          "INSERT INTO customers (email, phone, password_hash, name) VALUES (?, '1', ?, 'T') RETURNING id",
        )
          .bind(email, passwordHash)
          .first<{ id: number }>();
  return { id: row!.id, email };
}

async function tokenRows(audience: ResetAudience, accountId: number) {
  const { tokens, fk } = TABLES[audience];
  const { results } = await env.DB.prepare(`SELECT * FROM ${tokens} WHERE ${fk} = ?`)
    .bind(accountId)
    .all<{ token_hash: string; used_at: string | null }>();
  return results;
}

/** Ejecuta la solicitud y espera el envío en background. Devuelve los emails pedidos. */
async function request(audience: ResetAudience, email: string) {
  const pending: Promise<unknown>[] = [];
  await requestPasswordReset({ env: resetEnv, waitUntil: (p) => pending.push(p) }, audience, email);
  await Promise.all(pending);
}

describe('password-reset', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const sentEmails = () =>
    fetchSpy.mock.calls.map(([, init]) => emailRequestSchema.parse(JSON.parse(init?.body as string)));

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 202 }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe.each<ResetAudience>(['staff', 'customer'])('requestPasswordReset (%s)', (audience) => {
    it('crea un token (solo su hash) y pide el email de recuperación', async () => {
      const account = await createAccount(audience);

      await request(audience, account.email);

      const rows = await tokenRows(audience, account.id);
      expect(rows).toHaveLength(1);
      const [email] = sentEmails();
      expect(email).toMatchObject({ template: 'password-reset', to: account.email });
      expect(email!.data).toMatchObject({ expiresMinutes: 30 });
      // El token crudo viaja en el link, nunca en la DB.
      const rawToken = decodeURIComponent(email!.data.link.split('#token=')[1]!);
      expect(rows[0]!.token_hash).not.toBe(rawToken);
    });

    it('no crea token ni manda email si la cuenta no existe', async () => {
      await request(audience, 'nadie-existe@test.local');

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('un segundo pedido dentro del cooldown no manda otro email ni invalida el token vigente', async () => {
      const account = await createAccount(audience);

      await request(audience, account.email);
      const firstHash = (await tokenRows(audience, account.id))[0]!.token_hash;
      await request(audience, account.email);

      expect(sentEmails()).toHaveLength(1);
      const rows = await tokenRows(audience, account.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.token_hash).toBe(firstHash);
    });

    /** Simula que pasó el cooldown sin esperar: retrocede `created_at` de todos los tokens. */
    async function passCooldown(accountId: number) {
      const { tokens, fk } = TABLES[audience];
      await env.DB.prepare(`UPDATE ${tokens} SET created_at = datetime('now', ?) WHERE ${fk} = ?`)
        .bind(`-${RESET_REQUEST_COOLDOWN_SECONDS + 5} seconds`, accountId)
        .run();
    }

    it('pasado el cooldown emite otro token y el anterior sigue vigente (no se puede invalidar desde afuera)', async () => {
      const account = await createAccount(audience);
      await request(audience, account.email);
      const firstToken = decodeURIComponent(sentEmails()[0]!.data.link.split('#token=')[1]!);
      await passCooldown(account.id);

      await request(audience, account.email);

      expect(sentEmails()).toHaveLength(2);
      expect(await tokenRows(audience, account.id)).toHaveLength(2);
      expect(await resetPassword(resetEnv, audience, firstToken, 'stillvalidtoken1')).toBe(true);
    });

    it('no emite más de MAX_LIVE_RESET_TOKENS links vigentes por cuenta', async () => {
      const account = await createAccount(audience);

      for (let i = 0; i < MAX_LIVE_RESET_TOKENS + 2; i++) {
        await request(audience, account.email);
        await passCooldown(account.id);
      }

      expect(sentEmails()).toHaveLength(MAX_LIVE_RESET_TOKENS);
      expect(await tokenRows(audience, account.id)).toHaveLength(MAX_LIVE_RESET_TOKENS);
    });

    it('al canjear un token quedan inutilizados los demás tokens vigentes de la cuenta', async () => {
      const account = await createAccount(audience);
      await request(audience, account.email);
      await passCooldown(account.id);
      await request(audience, account.email);
      const [first, second] = sentEmails().map((e) => decodeURIComponent(e.data.link.split('#token=')[1]!));

      expect(await resetPassword(resetEnv, audience, second!, 'brandnewpassword456')).toBe(true);
      expect(await resetPassword(resetEnv, audience, first!, 'anotherpassword789')).toBe(false);
    });
  });

  it.each<ResetAudience>(['staff', 'customer'])(
    'pedidos simultáneos para la misma cuenta mandan un solo email (%s)',
    async (audience) => {
      const account = await createAccount(audience);

      await Promise.all(Array.from({ length: 6 }, () => request(audience, account.email)));

      expect(sentEmails()).toHaveLength(1);
      expect(await tokenRows(audience, account.id)).toHaveLength(1);
    },
  );

  it.each<ResetAudience>(['staff', 'customer'])(
    'dos canjes simultáneos del mismo token: solo uno gana (%s)',
    async (audience) => {
      const account = await createAccount(audience);
      await request(audience, account.email);
      const token = decodeURIComponent(sentEmails().at(-1)!.data.link.split('#token=')[1]!);

      const results = await Promise.all([
        resetPassword(resetEnv, audience, token, 'passwordnumber-one1'),
        resetPassword(resetEnv, audience, token, 'passwordnumber-two2'),
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
      const row = await env.DB.prepare(
        `SELECT token_version FROM ${TABLES[audience].accounts} WHERE id = ?`,
      )
        .bind(account.id)
        .first<{ token_version: number }>();
      expect(row!.token_version).toBe(1);
    },
  );

  it('el link de staff apunta al CMS y el de cliente a la web (primer origen)', async () => {
    const staff = await createAccount('staff');
    const customer = await createAccount('customer');

    await request('staff', staff.email);
    await request('customer', customer.email);

    const [staffEmail, customerEmail] = sentEmails();
    expect(staffEmail!.data.link).toMatch(/^https:\/\/cms\.saborllanero\.online\/reset-password#token=/);
    expect(customerEmail!.data.link).toMatch(
      /^https:\/\/saborllanero\.online\/cuenta\/restablecer\/#token=/,
    );
  });

  it('sin orígenes configurados cae a localhost (dev)', async () => {
    const customer = await createAccount('customer');
    const pending: Promise<unknown>[] = [];

    await requestPasswordReset(
      { env: { ...resetEnv, WEB_ORIGIN: undefined, CMS_ORIGIN: undefined }, waitUntil: (p) => pending.push(p) },
      'customer',
      customer.email,
    );
    await Promise.all(pending);

    expect(sentEmails()[0]!.data.link).toMatch(/^http:\/\/localhost:3000\/cuenta\/restablecer\/#token=/);
  });

  describe.each<ResetAudience>(['staff', 'customer'])('resetPassword (%s)', (audience) => {
    async function issueToken(email: string): Promise<string> {
      await request(audience, email);
      const sent = sentEmails().at(-1)!;
      return decodeURIComponent(sent.data.link.split('#token=')[1]!);
    }

    it('con un token válido cambia la contraseña, sube token_version y consume el token', async () => {
      const account = await createAccount(audience);
      const token = await issueToken(account.email);

      const ok = await resetPassword(resetEnv, audience, token, 'brandnewpassword456');

      expect(ok).toBe(true);
      const row = await env.DB.prepare(
        `SELECT password_hash, token_version FROM ${TABLES[audience].accounts} WHERE id = ?`,
      )
        .bind(account.id)
        .first<{ password_hash: string; token_version: number }>();
      expect(await verifyPassword('brandnewpassword456', row!.password_hash)).toBe(true);
      expect(row!.token_version).toBe(1);
      expect((await tokenRows(audience, account.id))[0]!.used_at).not.toBeNull();
    });

    it('no deja canjear el mismo token dos veces', async () => {
      const account = await createAccount(audience);
      const token = await issueToken(account.email);

      expect(await resetPassword(resetEnv, audience, token, 'firstchange123')).toBe(true);
      expect(await resetPassword(resetEnv, audience, token, 'secondchange456')).toBe(false);
    });

    it('rechaza un token vencido o inventado', async () => {
      const account = await createAccount(audience);
      const token = await issueToken(account.email);
      const { tokens, fk } = TABLES[audience];
      await env.DB.prepare(`UPDATE ${tokens} SET expires_at = datetime('now', '-1 minutes') WHERE ${fk} = ?`)
        .bind(account.id)
        .run();

      expect(await resetPassword(resetEnv, audience, token, 'whatever12345')).toBe(false);
      expect(await resetPassword(resetEnv, audience, 'nunca-existio', 'whatever12345')).toBe(false);
    });
  });

  it('un token de staff no sirve para resetear un cliente, ni al revés', async () => {
    const staff = await createAccount('staff');
    await request('staff', staff.email);
    const staffToken = decodeURIComponent(sentEmails().at(-1)!.data.link.split('#token=')[1]!);

    expect(await resetPassword(resetEnv, 'customer', staffToken, 'whatever12345')).toBe(false);
  });
});
