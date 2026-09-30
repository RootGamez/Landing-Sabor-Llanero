import { escapeHtml } from './html';
import type { TemplateDefinition } from './types';

// Pantallas de "nueva contraseña": la de clientes (web) y la de staff (CMS).
const RESET_PATHS = new Set(['/cuenta/restablecer/', '/reset-password']);
// 32 bytes aleatorios en base64url (sin relleno) = 43 caracteres, ver `lib/reset-token.ts` de la API.
const RESET_TOKEN_FRAGMENT = /^#token=[A-Za-z0-9_-]{43}$/;

/** Recuperación de contraseña (staff y clientes: el link ya apunta al origen correcto). */
export const passwordReset: TemplateDefinition<'password-reset'> = {
  linkFields: ['link'],
  isAllowedLink: (url) =>
    RESET_PATHS.has(url.pathname) && url.search === '' && RESET_TOKEN_FRAGMENT.test(url.hash),
  render({ link, expiresMinutes }) {
    const safeLink = escapeHtml(link);
    return {
      subject: 'Recuperar tu contraseña',
      html: `<p>Pediste recuperar tu contraseña. Este link vence en ${expiresMinutes} minutos:</p><p><a href="${safeLink}">${safeLink}</a></p><p>Si no fuiste tú, ignora este email.</p>`,
      text: `Pediste recuperar tu contraseña. Este link vence en ${expiresMinutes} minutos: ${link}\n\nSi no fuiste tú, ignora este email.`,
    };
  },
};
