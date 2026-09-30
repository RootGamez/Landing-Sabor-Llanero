/**
 * Envío de emails transaccionales. El Worker no habla SMTP: le pide el envío a
 * una Lambda de AWS (apps/mailer) con un POST firmado con HMAC. El contrato
 * (plantillas y datos permitidos) vive en `@sabor/shared` y es el mismo que
 * valida la Lambda. Para un email nuevo solo se llama `sendEmail` con otra
 * plantilla — no hay que tocar este archivo.
 */
import {
  EMAIL_CONTRACT_VERSION,
  EMAIL_SIGNATURE_HEADER,
  EMAIL_TIMESTAMP_HEADER,
  signEmailBody,
  type EmailData,
  type EmailTemplate,
} from '@sabor/shared';
import type { Bindings } from '../env';

/** Tope de espera a la Lambda; el envío corre en `waitUntil`, no bloquea la respuesta. */
const MAILER_TIMEOUT_MS = 8_000;

export type MailerEnv = Pick<Bindings, 'MAIL_LAMBDA_URL' | 'MAIL_LAMBDA_SECRET'>;

export class MailerError extends Error {
  constructor(
    readonly template: EmailTemplate,
    readonly status: number,
  ) {
    super(`El mailer respondió ${status} (template=${template})`);
    this.name = 'MailerError';
  }
}

/**
 * Pide el envío de un email. Sin `MAIL_LAMBDA_URL`/`MAIL_LAMBDA_SECRET`
 * (dev local) no hace nada, igual que los limitadores de rate limit sin
 * binding. Lanza `MailerError` si la Lambda responde un status de error.
 */
export async function sendEmail<T extends EmailTemplate>(
  env: MailerEnv,
  template: T,
  to: string,
  data: EmailData<T>,
): Promise<void> {
  if (!env.MAIL_LAMBDA_URL || !env.MAIL_LAMBDA_SECRET) return;

  const body = JSON.stringify({ v: EMAIL_CONTRACT_VERSION, template, to, data });
  const timestamp = String(Math.floor(Date.now() / 1000));

  const response = await fetch(env.MAIL_LAMBDA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [EMAIL_TIMESTAMP_HEADER]: timestamp,
      [EMAIL_SIGNATURE_HEADER]: await signEmailBody(env.MAIL_LAMBDA_SECRET, timestamp, body),
    },
    body,
    signal: AbortSignal.timeout(MAILER_TIMEOUT_MS),
  });
  if (!response.ok) throw new MailerError(template, response.status);
}

/**
 * Para usar dentro de `waitUntil`: nunca lanza (un fallo de email no debe
 * romper la respuesta ni delatar si la cuenta existe) pero sí lo deja en los
 * logs. No se loguea destinatario ni link, solo plantilla y causa.
 */
export async function sendEmailSafely<T extends EmailTemplate>(
  env: MailerEnv,
  template: T,
  to: string,
  data: EmailData<T>,
): Promise<void> {
  try {
    await sendEmail(env, template, to, data);
  } catch (err) {
    const cause = err instanceof MailerError ? `status=${err.status}` : String(err);
    console.error(`mailer: no se pudo enviar (template=${template}, ${cause})`);
  }
}
