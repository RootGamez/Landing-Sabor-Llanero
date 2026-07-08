/**
 * Hash de contraseñas con PBKDF2 vía Web Crypto (disponible nativo en Workers,
 * sin dependencias externas — bcrypt no corre en el runtime de Workers).
 * Formato de almacenamiento: "pbkdf2:<iteraciones>:<salt_base64>:<hash_base64>"
 */
const ITERATIONS = 100_000;
const HASH_BITS = 256;

/**
 * Hash dummy con el mismo costo (iteraciones) que uno real. Se usa en el login
 * cuando el email no existe: verificar siempre corre PBKDF2 con la misma latencia
 * para que no se pueda enumerar qué cuentas existen midiendo el tiempo de respuesta.
 */
export const DUMMY_PASSWORD_HASH = `pbkdf2:${ITERATIONS}:AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashBytes = await deriveBits(password, salt, ITERATIONS);
  return `pbkdf2:${ITERATIONS}:${toBase64(salt)}:${toBase64(hashBytes)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = fromBase64(parts[2]!);
  const expected = parts[3]!;
  const hashBytes = await deriveBits(password, salt, iterations);
  return timingSafeEqual(toBase64(hashBytes), expected);
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    HASH_BITS,
  );
  return new Uint8Array(bits);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
