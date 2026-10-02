/**
 * Validación de formularios compartida por la web (clientes) y el CMS (staff):
 * funciones puras que devuelven el mensaje de error (en español) o `null` si el
 * valor es válido. Los límites también los usa `validation.ts`, así el
 * frontend y la API no se desincronizan.
 */

export const FULL_NAME_MAX = 60;
export const EMAIL_MAX = 254;
export const PHONE_MAX = 30;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const EMAIL_LOCAL_MAX = 64;
const PHONE_DIGITS_MIN = 7;
const PHONE_DIGITS_MAX = 15;

/** Cada palabra del nombre: empieza con una letra; admite tildes, apóstrofes, guiones y puntos (iniciales). */
const NAME_WORD = /^\p{L}[\p{L}\p{M}'’.-]*$/u;
// Parte local con las mismas reglas que `z.string().email()` del servidor (zod 4): sin puntos al
// inicio/final ni seguidos, y el último carácter no puede ser apóstrofe. Cada regex es lineal
// (sin cuantificadores anidados): el dominio se valida por etiquetas, no con un solo patrón.
const EMAIL_LOCAL = /^(?:[A-Za-z0-9_'+-][A-Za-z0-9_'+.-]*[A-Za-z0-9_+-]|[A-Za-z0-9_+-])$/;
const EMAIL_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const EMAIL_TLD = /^[A-Za-z]{2,}$/;
const EMAIL_LABEL_MAX = 63;
const PHONE = /^\+?[0-9(][0-9\s().-]*$/;

/** Recorta y colapsa espacios repetidos (también tabs y saltos de línea). */
export function normalizeFullName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Minúsculas y sin espacios en los bordes (los emails no distinguen mayúsculas). */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Exige nombre y apellido (al menos dos palabras) con un largo razonable. */
export function fullNameError(raw: string): string | null {
  const words = normalizeFullName(raw).split(' ').filter(Boolean);
  if (words.length < 2) return 'Ingresa tu nombre y apellido';
  if (!words.every((word) => NAME_WORD.test(word))) {
    return 'Usa solo letras en tu nombre (se permiten tildes, guiones y apóstrofes)';
  }
  if (words.join(' ').length > FULL_NAME_MAX) return `El nombre no puede superar los ${FULL_NAME_MAX} caracteres`;
  return null;
}

function isValidEmailShape(email: string): boolean {
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local = '', domain = ''] = parts;
  if (local.length > EMAIL_LOCAL_MAX || local.includes('..') || !EMAIL_LOCAL.test(local)) return false;

  const labels = domain.split('.');
  const tld = labels.pop() ?? '';
  if (labels.length === 0 || tld.length > EMAIL_LABEL_MAX || !EMAIL_TLD.test(tld)) return false;
  return labels.every((label) => label.length <= EMAIL_LABEL_MAX && EMAIL_LABEL.test(label));
}

/** Valida sobre el texto tal cual (sin recortar): normaliza antes con `normalizeEmail`. */
export function emailError(email: string): string | null {
  if (!email) return 'Ingresa tu email';
  if (email.length > EMAIL_MAX) return `El email no puede superar los ${EMAIL_MAX} caracteres`;
  return isValidEmailShape(email) ? null : 'Ingresa un email válido, por ejemplo nombre@dominio.com';
}

export function phoneError(raw: string): string | null {
  const phone = raw.trim();
  if (!phone) return 'Ingresa tu celular';
  const digits = phone.replace(/\D/g, '').length;
  if (phone.length > PHONE_MAX || !PHONE.test(phone) || digits < PHONE_DIGITS_MIN || digits > PHONE_DIGITS_MAX) {
    return 'Ingresa un celular válido (solo números, puede incluir +51 y espacios)';
  }
  return null;
}

/** Sin reglas de composición (mayúsculas, símbolos): se prioriza el largo y se permiten frases. */
export function passwordError(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
  if (password.length > PASSWORD_MAX) return `La contraseña no puede superar los ${PASSWORD_MAX} caracteres`;
  return null;
}

export function passwordConfirmError(password: string, confirm: string): string | null {
  if (!confirm) return 'Repite la contraseña';
  if (password !== confirm) return 'Las contraseñas no coinciden';
  return null;
}

/** Mensaje que devuelve la API (401) cuando la contraseña actual no coincide; los clientes lo usan para no cerrar la sesión por error. */
export const WRONG_CURRENT_PASSWORD_MESSAGE = 'La contraseña actual es incorrecta';

/** El checkbox del registro: sin marcarlo no se puede crear la cuenta. */
export function termsAcceptedError(accepted: boolean): string | null {
  return accepted ? null : 'Debes aceptar los Términos y la Política de Privacidad';
}
