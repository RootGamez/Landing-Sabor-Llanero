/**
 * Tokens de recuperación de contraseña: mismo criterio Web-Crypto-only que
 * `lib/password.ts` (sin dependencias externas). El token crudo viaja en el
 * link del email y nunca se persiste — solo su hash SHA-256, en base64url
 * para que quede prolijo dentro de una URL.
 */
const TOKEN_BYTES = 32;

export function generateResetToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return toBase64Url(bytes);
}

export async function hashResetToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return toBase64Url(new Uint8Array(digest));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
