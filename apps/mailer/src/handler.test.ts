import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMAIL_SIGNATURE_HEADER,
  EMAIL_TIMESTAMP_HEADER,
  signEmailBody,
  type EmailRequest,
} from '@sabor/shared';
import { createHandler, type LambdaUrlEvent, type MailTransport } from './handler';
import type { MailerConfig } from './config';

const SECRET = 'test-signing-secret';
const RECIPIENT = 'cliente@example.com';
const TOKEN = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v";
const LINK = `https://saborllanero.online/cuenta/restablecer/#token=${TOKEN}`;

const config: MailerConfig = {
  smtp: { host: 'smtp.example.com', port: 465, secure: true, user: 'u', pass: 'p' },
  from: { address: 'no-responder@saborllanero.online', name: 'Sabor Llanero' },
  signingSecret: SECRET,
  allowedLinkOrigins: ['https://saborllanero.online', 'https://cms.saborllanero.online'],
};

const validRequest: EmailRequest = {
  v: 1,
  template: 'password-reset',
  to: RECIPIENT,
  data: { link: LINK, expiresMinutes: 30 },
};

async function signedEvent(
  body: string,
  overrides: Partial<LambdaUrlEvent> = {},
  timestamp = String(Math.floor(Date.now() / 1000)),
): Promise<LambdaUrlEvent> {
  return {
    body,
    isBase64Encoded: false,
    headers: {
      [EMAIL_TIMESTAMP_HEADER]: timestamp,
      [EMAIL_SIGNATURE_HEADER]: await signEmailBody(SECRET, timestamp, body),
    },
    requestContext: { http: { method: 'POST' } },
    ...overrides,
  };
}

describe('handler', () => {
  let sendMail: ReturnType<typeof vi.fn>;
  let handler: ReturnType<typeof createHandler>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sendMail = vi.fn().mockResolvedValue({ messageId: '<abc@smtp>' });
    const transport: MailTransport = { sendMail: sendMail as MailTransport['sendMail'] };
    handler = createHandler({ config, transport });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('envía el email y responde 202 con el messageId', async () => {
    const res = await handler(await signedEvent(JSON.stringify(validRequest)));

    expect(res.statusCode).toBe(202);
    expect(JSON.parse(res.body)).toEqual({ messageId: '<abc@smtp>' });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0]![0];
    expect(mail.to).toBe(RECIPIENT);
    expect(mail.from).toEqual({ address: 'no-responder@saborllanero.online', name: 'Sabor Llanero' });
    expect(mail.subject).toBe('Recuperar tu contraseña');
    expect(mail.html).toContain(LINK);
    expect(mail.text).toContain(LINK);
  });

  it('acepta el body en base64', async () => {
    const body = JSON.stringify(validRequest);
    const event = await signedEvent(body, {
      body: Buffer.from(body).toString('base64'),
      isBase64Encoded: true,
    });

    const res = await handler(event);

    expect(res.statusCode).toBe(202);
  });

  it('rechaza métodos que no son POST con 405', async () => {
    const event = await signedEvent(JSON.stringify(validRequest), {
      requestContext: { http: { method: 'GET' } },
    });

    const res = await handler(event);

    expect(res.statusCode).toBe(405);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rechaza una firma inválida con 401', async () => {
    const event = await signedEvent(JSON.stringify(validRequest));
    event.headers[EMAIL_SIGNATURE_HEADER] = 'a'.repeat(64);

    const res = await handler(event);

    expect(res.statusCode).toBe(401);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rechaza un request sin headers de firma con 401', async () => {
    const res = await handler({
      body: JSON.stringify(validRequest),
      headers: {},
      requestContext: { http: { method: 'POST' } },
    });

    expect(res.statusCode).toBe(401);
  });

  it('rechaza una firma vencida (replay) con 401', async () => {
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 3600);
    const event = await signedEvent(JSON.stringify(validRequest), {}, oldTimestamp);

    const res = await handler(event);

    expect(res.statusCode).toBe(401);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rechaza una firma hecha para otro body con 401', async () => {
    const event = await signedEvent(JSON.stringify(validRequest));
    event.body = JSON.stringify({ ...validRequest, to: 'otro@example.com' });

    const res = await handler(event);

    expect(res.statusCode).toBe(401);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rechaza un body que no es JSON con 400', async () => {
    const res = await handler(await signedEvent('no-es-json'));

    expect(res.statusCode).toBe(400);
  });

  it('rechaza una plantilla desconocida con 400', async () => {
    const body = JSON.stringify({ ...validRequest, template: 'inexistente' });

    const res = await handler(await signedEvent(body));

    expect(res.statusCode).toBe(400);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rechaza un destinatario inválido con 400', async () => {
    const body = JSON.stringify({ ...validRequest, to: 'no-es-un-email' });

    const res = await handler(await signedEvent(body));

    expect(res.statusCode).toBe(400);
  });

  it('rechaza un link de un origen no permitido con 400', async () => {
    const body = JSON.stringify({
      ...validRequest,
      data: { link: 'https://evil.example.com/phish#token=x', expiresMinutes: 30 },
    });

    const res = await handler(await signedEvent(body));

    expect(res.statusCode).toBe(400);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('no deja pasar un origen que solo empieza igual que uno permitido', async () => {
    const body = JSON.stringify({
      ...validRequest,
      data: { link: 'https://saborllanero.online.evil.com/x', expiresMinutes: 30 },
    });

    const res = await handler(await signedEvent(body));

    expect(res.statusCode).toBe(400);
  });

  it.each([
    ['con caracteres que el parser de URL descarta (tab/salto de línea)', `${LINK}\t\ntexto-extra`],
    ['con credenciales embebidas', `https://evil.example.com@saborllanero.online/cuenta/restablecer/#token=${TOKEN}`],
    ['a una ruta que no es la de restablecer', `https://saborllanero.online/otra-ruta/#token=${TOKEN}`],
    ['con un token que no tiene el formato esperado', 'https://saborllanero.online/cuenta/restablecer/#token=corto'],
    ['con query string', `https://saborllanero.online/cuenta/restablecer/?x=1#token=${TOKEN}`],
  ])('rechaza un link %s con 400', async (_label, link) => {
    const body = JSON.stringify({ ...validRequest, data: { link, expiresMinutes: 30 } });

    const res = await handler(await signedEvent(body));

    expect(res.statusCode).toBe(400);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('acepta el link del CMS para recuperar contraseña de staff', async () => {
    const link = `https://cms.saborllanero.online/reset-password#token=${TOKEN}`;
    const body = JSON.stringify({ ...validRequest, data: { link, expiresMinutes: 30 } });

    const res = await handler(await signedEvent(body));

    expect(res.statusCode).toBe(202);
  });

  it('rechaza un body demasiado grande con 413', async () => {
    const res = await handler(await signedEvent('x'.repeat(20_000)));

    expect(res.statusCode).toBe(413);
  });

  it('responde 502 si falla el SMTP, sin loguear destinatario ni link', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('535 auth failed'), { code: 'EAUTH' }));

    const res = await handler(await signedEvent(JSON.stringify(validRequest)));

    expect(res.statusCode).toBe(502);
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain('EAUTH');
    expect(logged).not.toContain(RECIPIENT);
    expect(logged).not.toContain(TOKEN);
  });
});
