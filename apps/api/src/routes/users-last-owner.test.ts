import { env, exports } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../lib/password';
import { signToken } from '../lib/jwt';

const app = exports.default;

/**
 * Archivo separado a propósito: el guard de "no degradar/eliminar al último
 * owner" (routes/users.ts) solo se prueba de verdad con EXACTAMENTE un owner
 * en la tabla. @cloudflare/vitest-plugin aísla el storage por archivo, así
 * que acá arrancamos con D1 vacío (solo migraciones, sin las filas que
 * siembran otros archivos como users.test.ts).
 */
describe('routes/users — guard del último owner', () => {
  let ownerId: number;
  let ownerToken: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('correcthorsebattery');
    const row = await env.DB.prepare(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?) RETURNING id, token_version',
    )
      .bind('unico-owner@test.local', passwordHash, 'Único Owner', 'owner')
      .first<{ id: number; token_version: number }>();
    ownerId = row!.id;
    ownerToken = await signToken(
      { id: ownerId, email: 'unico-owner@test.local', role: 'owner' },
      env.JWT_SECRET,
      row!.token_version,
    );
  });

  it('confirma que hay exactamente un owner antes de probar el guard', async () => {
    const count = await env.DB.prepare("SELECT COUNT(*) as n FROM users WHERE role = 'owner'").first<{
      n: number;
    }>();
    expect(count?.n).toBe(1);
  });

  it('no permite degradar al último owner (409)', async () => {
    const res = await app.fetch(`https://example.com/api/users/${ownerId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    });
    expect(res.status).toBe(409);

    // Confirma que el rol NO cambió en la DB (el guard bloqueó la escritura, no solo la respuesta).
    const row = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(ownerId).first<{
      role: string;
    }>();
    expect(row?.role).toBe('owner');
  });

  it('el guard de "último owner" del DELETE es inalcanzable en la práctica: el único owner que intenta eliminarse choca primero con el guard de auto-eliminación (403, no 409)', async () => {
    // La ruta entera exige requireRole('owner') (users.ts:14), así que solo
    // un owner puede llamar DELETE. Con un único owner en la tabla, ese owner
    // ES el `actingUser`, así que `actingUser.id === id` (guard de línea 85)
    // se cumple SIEMPRE antes de llegar al WHERE con el conteo de owners —
    // no hay forma de que un owner DISTINTO ataque al último owner cuando
    // "distinto" y "último" son mutuamente excluyentes. El WHERE de la query
    // sigue siendo defensa en profundidad correcta (mismo criterio que el
    // JWT separado de clientes), solo que este escenario puntual no es
    // alcanzable por HTTP — se documenta acá en vez de asumirlo sin probarlo.
    const res = await app.fetch(`https://example.com/api/users/${ownerId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(res.status).toBe(403);

    const row = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(ownerId).first();
    expect(row).not.toBeNull();
  });

  it('degradar SÍ funciona una vez que hay un segundo owner', async () => {
    const passwordHash = await hashPassword('correcthorsebattery');
    await env.DB.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)')
      .bind('segundo-owner@test.local', passwordHash, 'Segundo Owner', 'owner')
      .run();

    const res = await app.fetch(`https://example.com/api/users/${ownerId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    });
    expect(res.status).toBe(200);
  });
});
