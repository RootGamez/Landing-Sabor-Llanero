import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

const validEnv = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_USER: 'user@example.com',
  SMTP_PASS: 'secret',
  MAIL_FROM: 'no-responder@saborllanero.online',
  MAIL_FROM_NAME: 'Sabor Llanero',
  SIGNING_SECRET: '0123456789abcdef0123456789abcdef',
  ALLOWED_LINK_ORIGINS: 'https://saborllanero.online, https://cms.saborllanero.online',
};

describe('loadConfig', () => {
  it('parsea puerto, secure y la lista de orígenes permitidos', () => {
    const config = loadConfig(validEnv);

    expect(config.smtp.port).toBe(465);
    expect(config.smtp.secure).toBe(true);
    expect(config.allowedLinkOrigins).toEqual([
      'https://saborllanero.online',
      'https://cms.saborllanero.online',
    ]);
  });

  it('SMTP_SECURE distinto de "true" da false (STARTTLS en 587)', () => {
    const config = loadConfig({ ...validEnv, SMTP_PORT: '587', SMTP_SECURE: 'false' });

    expect(config.smtp.secure).toBe(false);
  });

  it.each(Object.keys(validEnv))('falla si falta %s', (name) => {
    const env: Record<string, string | undefined> = { ...validEnv };
    delete env[name];

    expect(() => loadConfig(env)).toThrow(name);
  });

  it("falla si SIGNING_SECRET es demasiado corto", () => {
    expect(() => loadConfig({ ...validEnv, SIGNING_SECRET: "corto" })).toThrow("SIGNING_SECRET");
  });

  it.each([
    ["un esquema que no es http(s)", "javascript:alert(1)"],
    ["http en un dominio que no es local", "http://saborllanero.online"],
    ["un valor que no es una URL", "no-es-una-url"],
  ])("rechaza en ALLOWED_LINK_ORIGINS %s", (_label, origin) => {
    expect(() => loadConfig({ ...validEnv, ALLOWED_LINK_ORIGINS: origin })).toThrow("ALLOWED_LINK_ORIGINS");
  });

  it("permite http solo para localhost (desarrollo)", () => {
    const config = loadConfig({ ...validEnv, ALLOWED_LINK_ORIGINS: "http://localhost:3000" });

    expect(config.allowedLinkOrigins).toEqual(["http://localhost:3000"]);
  });

  it('falla si el puerto no es un número válido', () => {
    expect(() => loadConfig({ ...validEnv, SMTP_PORT: 'abc' })).toThrow('SMTP_PORT');
  });
});
