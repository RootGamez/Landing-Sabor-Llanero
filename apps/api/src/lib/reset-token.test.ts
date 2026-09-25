import { describe, expect, it } from 'vitest';
import { generateResetToken, hashResetToken } from './reset-token';

describe('generateResetToken / hashResetToken', () => {
  it('genera tokens distintos en cada llamada (suficiente entropía)', () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(a).not.toBe(b);
  });

  it('genera un token base64url (sin +, / ni = de relleno) apto para un fragment de URL', () => {
    const token = generateResetToken();
    expect(token).not.toMatch(/[+/=]/);
    expect(token.length).toBeGreaterThan(30); // 32 bytes -> ~43 chars en base64url
  });

  it('hashea el mismo token siempre al mismo valor (determinístico, para poder buscarlo por hash)', async () => {
    const token = generateResetToken();
    const hash1 = await hashResetToken(token);
    const hash2 = await hashResetToken(token);
    expect(hash1).toBe(hash2);
  });

  it('el hash nunca es igual al token crudo (nunca se persiste en claro)', async () => {
    const token = generateResetToken();
    const hash = await hashResetToken(token);
    expect(hash).not.toBe(token);
  });

  it('tokens distintos producen hashes distintos', async () => {
    const hashA = await hashResetToken(generateResetToken());
    const hashB = await hashResetToken(generateResetToken());
    expect(hashA).not.toBe(hashB);
  });
});
