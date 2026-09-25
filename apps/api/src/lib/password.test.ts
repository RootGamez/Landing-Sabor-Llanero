import { describe, expect, it } from 'vitest';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './password';

describe('hashPassword / verifyPassword', () => {
  it('verifica correctamente una contraseña recién hasheada', async () => {
    const hash = await hashPassword('correcthorsebattery');
    expect(await verifyPassword('correcthorsebattery', hash)).toBe(true);
  });

  it('rechaza una contraseña incorrecta', async () => {
    const hash = await hashPassword('correcthorsebattery');
    expect(await verifyPassword('wrongpassword', hash)).toBe(false);
  });

  it('nunca guarda la contraseña en texto plano', async () => {
    const hash = await hashPassword('correcthorsebattery');
    expect(hash).not.toContain('correcthorsebattery');
    expect(hash.startsWith('pbkdf2:100000:')).toBe(true);
  });

  it('genera un salt distinto en cada llamada (dos hashes de la misma contraseña difieren)', async () => {
    const hash1 = await hashPassword('correcthorsebattery');
    const hash2 = await hashPassword('correcthorsebattery');
    expect(hash1).not.toBe(hash2);
  });

  it('rechaza un hash con formato inválido en vez de tirar una excepción', async () => {
    await expect(verifyPassword('cualquiera', 'no-es-un-hash-valido')).resolves.toBe(false);
  });

  it('DUMMY_PASSWORD_HASH nunca verifica como válido (anti-enumeración)', async () => {
    expect(await verifyPassword('cualquiera', DUMMY_PASSWORD_HASH)).toBe(false);
  });
});
