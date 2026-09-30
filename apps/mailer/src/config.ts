/**
 * Configuración de la Lambda, leída de sus variables de entorno (cifradas en
 * reposo por AWS). Falla explícito si falta algo: es preferible un error claro
 * en el primer request que enviar con un remitente o secret vacío.
 */
export interface MailerConfig {
  smtp: { host: string; port: number; secure: boolean; user: string; pass: string };
  from: { address: string; name: string };
  signingSecret: string;
  /** Orígenes (scheme + host) a los que puede apuntar un link dentro de un email. */
  allowedLinkOrigins: string[];
}

type Env = Record<string, string | undefined>;

function required(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

function parsePort(raw: string): number {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`SMTP_PORT inválido: ${raw}`);
  }
  return port;
}

/** El secreto HMAC debe ser largo: es lo único que protege la Function URL (sin auth de AWS). */
const MIN_SIGNING_SECRET_LENGTH = 32;
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

/** Solo https (http únicamente para localhost, en desarrollo). Esquemas opacos dan origen "null". */
function parseOrigin(origin: string): string {
  const invalid = () => new Error(`ALLOWED_LINK_ORIGINS contiene un origen inválido: ${origin}`);
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw invalid();
  }
  const isSecure = url.protocol === 'https:';
  const isLocalHttp = url.protocol === 'http:' && LOCAL_HOSTNAMES.has(url.hostname);
  if (!isSecure && !isLocalHttp) throw invalid();
  return url.origin;
}

function parseOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
    .map(parseOrigin);
}

function parseSigningSecret(raw: string): string {
  if (raw.length < MIN_SIGNING_SECRET_LENGTH) {
    throw new Error(`SIGNING_SECRET debe tener al menos ${MIN_SIGNING_SECRET_LENGTH} caracteres`);
  }
  return raw;
}

export function loadConfig(env: Env): MailerConfig {
  return {
    smtp: {
      host: required(env, 'SMTP_HOST'),
      port: parsePort(required(env, 'SMTP_PORT')),
      secure: required(env, 'SMTP_SECURE') === 'true',
      user: required(env, 'SMTP_USER'),
      pass: required(env, 'SMTP_PASS'),
    },
    from: { address: required(env, 'MAIL_FROM'), name: required(env, 'MAIL_FROM_NAME') },
    signingSecret: parseSigningSecret(required(env, 'SIGNING_SECRET')),
    allowedLinkOrigins: parseOrigins(required(env, 'ALLOWED_LINK_ORIGINS')),
  };
}
