import nodemailer from 'nodemailer';
import { loadConfig } from './config';
import { createHandler, type LambdaUrlEvent, type LambdaUrlResponse, type MailTransport } from './handler';

const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
const SMTP_SOCKET_TIMEOUT_MS = 15_000;

type Handler = (event: LambdaUrlEvent) => Promise<LambdaUrlResponse>;

// Se arma una sola vez por contenedor: las invocaciones "warm" reutilizan
// la configuración y la conexión SMTP.
let cached: Handler | undefined;

function build(): Handler {
  const config = loadConfig(process.env);
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
  });
  const transport: MailTransport = {
    sendMail: async (mail) => {
      const info = await transporter.sendMail(mail);
      return { messageId: info.messageId };
    },
  };
  return createHandler({ config, transport });
}

export const handler: Handler = async (event) => {
  cached ??= build();
  return cached(event);
};
