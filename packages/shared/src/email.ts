/**
 * Contrato de emails transaccionales entre la API (Worker) y la Lambda de
 * envío (apps/mailer). Fuente única: el Worker lo usa para tipar lo que manda
 * y la Lambda para validar lo que recibe.
 *
 * Para sumar un email nuevo: agregar su variante a `emailRequestSchema` (aquí),
 * su plantilla en `apps/mailer/src/templates/` y llamarlo desde la API con
 * `sendEmail(...)`. La firma y el transporte no cambian.
 *
 * Usa solo Web Crypto (disponible en Workers y en Node 22), así la misma
 * firma/verificación corre en ambos lados sin duplicar código.
 */
import { z } from 'zod';

/** Versión del envelope; permite sumar campos (replyTo, adjuntos) sin romper lo existente. */
export const EMAIL_CONTRACT_VERSION = 1;

export const EMAIL_SIGNATURE_HEADER = 'x-mailer-signature';
export const EMAIL_TIMESTAMP_HEADER = 'x-mailer-timestamp';
/** Ventana de validez de una firma (anti-replay). */
export const EMAIL_MAX_SKEW_SECONDS = 60;

const LINK_MAX = 2048;
const RECIPIENT_MAX = 254;

function emailRequest<T extends string, D extends z.ZodType>(template: T, data: D) {
  return z.object({
    v: z.literal(EMAIL_CONTRACT_VERSION),
    template: z.literal(template),
    to: z.string().email().max(RECIPIENT_MAX),
    data,
  });
}

/** Una variante por plantilla. Agregar aquí las nuevas. */
export const emailRequestSchema = z.discriminatedUnion('template', [
  emailRequest(
    'password-reset',
    z.object({
      link: z.string().url().max(LINK_MAX),
      expiresMinutes: z.number().int().positive().max(1440),
    }),
  ),
]);

export type EmailRequest = z.infer<typeof emailRequestSchema>;
export type EmailTemplate = EmailRequest['template'];
export type EmailData<T extends EmailTemplate> = Extract<EmailRequest, { template: T }>['data'];

const encoder = new TextEncoder();

function signingInput(timestamp: string, body: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(encoder.encode(`${timestamp}.${body}`));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function importKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    usage,
  ]);
}

/** HMAC-SHA256 (hex) de `${timestamp}.${body}`. */
export async function signEmailBody(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await importKey(secret, 'sign');
  const signature = await crypto.subtle.sign('HMAC', key, signingInput(timestamp, body));
  return toHex(new Uint8Array(signature));
}

/**
 * Verifica firma y antigüedad. `crypto.subtle.verify` compara en tiempo
 * constante. `nowMs` es inyectable para testear la ventana de tiempo.
 */
export async function verifyEmailSignature(params: {
  secret: string;
  timestamp: string | null | undefined;
  signature: string | null | undefined;
  body: string;
  nowMs?: number;
}): Promise<boolean> {
  const { secret, timestamp, signature, body, nowMs = Date.now() } = params;
  if (!timestamp || !signature) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds)) return false;
  if (Math.abs(nowMs / 1000 - timestampSeconds) > EMAIL_MAX_SKEW_SECONDS) return false;

  const signatureBytes = fromHex(signature);
  if (!signatureBytes) return false;

  const key = await importKey(secret, 'verify');
  return crypto.subtle.verify('HMAC', key, signatureBytes, signingInput(timestamp, body));
}
