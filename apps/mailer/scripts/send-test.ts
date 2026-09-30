/**
 * Envía un email de prueba firmado a la Lambda ya desplegada.
 *
 *   MAILER_URL=https://xxxx.lambda-url.us-east-1.on.aws/ \
 *   MAILER_SECRET=<el SIGNING_SECRET> \
 *   TO=tu@email.com \
 *   pnpm --filter @sabor/mailer send-test
 *
 * LINK_ORIGIN (opcional) debe estar en ALLOWED_LINK_ORIGINS de la Lambda.
 */
import {
  EMAIL_CONTRACT_VERSION,
  EMAIL_SIGNATURE_HEADER,
  EMAIL_TIMESTAMP_HEADER,
  signEmailBody,
  type EmailRequest,
} from '@sabor/shared';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Falta la variable de entorno ${name}`);
    process.exit(1);
  }
  return value;
}

const url = requiredEnv('MAILER_URL');
const secret = requiredEnv('MAILER_SECRET');
const to = requiredEnv('TO');
const linkOrigin = process.env.LINK_ORIGIN ?? 'https://saborllanero.online';

const request: EmailRequest = {
  v: EMAIL_CONTRACT_VERSION,
  template: 'password-reset',
  to,
  data: { link: `${linkOrigin}/cuenta/restablecer/#token=${'A'.repeat(43)}`, expiresMinutes: 30 },
};

const body = JSON.stringify(request);
const timestamp = String(Math.floor(Date.now() / 1000));

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    [EMAIL_TIMESTAMP_HEADER]: timestamp,
    [EMAIL_SIGNATURE_HEADER]: await signEmailBody(secret, timestamp, body),
  },
  body,
});

console.log(response.status, await response.text());
process.exit(response.ok ? 0 : 1);
