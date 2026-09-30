import {
  EMAIL_SIGNATURE_HEADER,
  EMAIL_TIMESTAMP_HEADER,
  emailRequestSchema,
  verifyEmailSignature,
  type EmailRequest,
} from '@sabor/shared';
import type { MailerConfig } from './config';
import { templates, type TemplateDefinition } from './templates';

/** Subconjunto del evento de una Lambda Function URL (payload v2) que usamos. */
export interface LambdaUrlEvent {
  body?: string;
  isBase64Encoded?: boolean;
  /** Las Function URLs entregan los nombres de header en minúsculas. */
  headers: Record<string, string | undefined>;
  requestContext: { http: { method: string } };
}

export interface LambdaUrlResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface OutgoingMail {
  from: { address: string; name: string };
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Abstracción mínima de nodemailer, para poder testear sin red. */
export interface MailTransport {
  sendMail(mail: OutgoingMail): Promise<{ messageId: string }>;
}

const MAX_BODY_BYTES = 16 * 1024;

function respond(statusCode: number, payload: Record<string, unknown>): LambdaUrlResponse {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

function decodeBody(event: LambdaUrlEvent): string {
  const raw = event.body ?? '';
  return event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw;
}

function templateFor(request: EmailRequest): TemplateDefinition<EmailRequest['template']> {
  return templates[request.template] as TemplateDefinition<EmailRequest['template']>;
}

/**
 * Un link dentro del email solo puede apuntar a un origen permitido: si el
 * secret de firma se filtrara, igual no serviría para mandar phishing libre.
 */
function hasDisallowedLink(request: EmailRequest, allowedOrigins: string[]): boolean {
  const data = request.data as Record<string, unknown>;
  const template = templateFor(request);
  return template.linkFields.some((field) => {
    const raw = String(data[field]);
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return true;
    }
    // `url.href === raw`: el parser de URL descarta tab/saltos de línea y normaliza
    // `\`; si el texto crudo difiere de lo parseado, lo que se renderiza en el email
    // no sería lo que se validó.
    const valid =
      allowedOrigins.includes(url.origin) &&
      url.href === raw &&
      !url.username &&
      !url.password &&
      template.isAllowedLink(url);
    return !valid;
  });
}

export function createHandler(deps: { config: MailerConfig; transport: MailTransport }) {
  const { config, transport } = deps;

  return async function handler(event: LambdaUrlEvent): Promise<LambdaUrlResponse> {
    if (event.requestContext.http.method !== 'POST') {
      return respond(405, { error: 'method not allowed' });
    }

    const body = decodeBody(event);
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      return respond(413, { error: 'payload too large' });
    }

    const authentic = await verifyEmailSignature({
      secret: config.signingSecret,
      timestamp: event.headers[EMAIL_TIMESTAMP_HEADER],
      signature: event.headers[EMAIL_SIGNATURE_HEADER],
      body,
    });
    if (!authentic) {
      console.warn('mailer: request rechazado por firma inválida o vencida');
      return respond(401, { error: 'unauthorized' });
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return respond(400, { error: 'invalid request' });
    }

    const parsed = emailRequestSchema.safeParse(json);
    if (!parsed.success || hasDisallowedLink(parsed.data, config.allowedLinkOrigins)) {
      return respond(400, { error: 'invalid request' });
    }

    const request = parsed.data;
    const rendered = templateFor(request).render(request.data);

    try {
      const { messageId } = await transport.sendMail({
        from: config.from,
        to: request.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      return respond(202, { messageId });
    } catch (err) {
      // Solo plantilla y código de error: nunca destinatario, link ni credenciales.
      const code = (err as { code?: string }).code ?? 'UNKNOWN';
      console.error(`mailer: fallo el envío SMTP (template=${request.template}, code=${code})`);
      return respond(502, { error: 'send failed' });
    }
  };
}
