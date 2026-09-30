import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMAIL_SIGNATURE_HEADER,
  EMAIL_TIMESTAMP_HEADER,
  emailRequestSchema,
  verifyEmailSignature,
} from '@sabor/shared';
import { MailerError, sendEmail, sendEmailSafely } from './mailer';

const LAMBDA_URL = 'https://mailer.example.test/';
const SECRET = 'test-mailer-secret';
const configured = { MAIL_LAMBDA_URL: LAMBDA_URL, MAIL_LAMBDA_SECRET: SECRET };
const resetData = { link: 'https://saborllanero.online/cuenta/restablecer/#token=abc', expiresMinutes: 30 };

describe('sendEmail', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"messageId":"<x>"}', { status: 202 }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('no hace nada (ni falla) si el mailer no está configurado', async () => {
    await sendEmail({}, 'password-reset', 'a@b.co', resetData);
    await sendEmail({ MAIL_LAMBDA_URL: LAMBDA_URL }, 'password-reset', 'a@b.co', resetData);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('hace POST a la Lambda con un envelope válido y firmado', async () => {
    await sendEmail(configured, 'password-reset', 'cliente@example.com', resetData);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(LAMBDA_URL);
    expect(init?.method).toBe('POST');

    const body = init?.body as string;
    const parsed = emailRequestSchema.safeParse(JSON.parse(body));
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ template: 'password-reset', to: 'cliente@example.com' });

    const headers = init?.headers as Record<string, string>;
    const valid = await verifyEmailSignature({
      secret: SECRET,
      timestamp: headers[EMAIL_TIMESTAMP_HEADER],
      signature: headers[EMAIL_SIGNATURE_HEADER],
      body,
    });
    expect(valid).toBe(true);
  });

  it('corta la espera con un timeout', async () => {
    await sendEmail(configured, 'password-reset', 'a@b.co', resetData);

    expect(fetchSpy.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('lanza MailerError si la Lambda responde un status de error', async () => {
    fetchSpy.mockResolvedValue(new Response('{"error":"send failed"}', { status: 502 }));

    await expect(sendEmail(configured, 'password-reset', 'a@b.co', resetData)).rejects.toThrow(
      MailerError,
    );
  });
});

describe('sendEmailSafely', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    errorSpy.mockRestore();
    fetchSpy.mockRestore();
  });

  it('traga el error de red y lo loguea sin destinatario ni link', async () => {
    fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      sendEmailSafely(configured, 'password-reset', 'cliente@example.com', resetData),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain('password-reset');
    expect(logged).not.toContain('cliente@example.com');
    expect(logged).not.toContain('token=abc');
  });

  it('traga también un error de status de la Lambda', async () => {
    fetchSpy.mockResolvedValue(new Response('nope', { status: 401 }));

    await expect(
      sendEmailSafely(configured, 'password-reset', 'a@b.co', resetData),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(errorSpy.mock.calls)).toContain('401');
  });
});
