import { sign, verify } from 'hono/jwt';
import type { AuthUser } from '../env';

const EXPIRY_SECONDS = 60 * 60 * 24; // 1 dia (la revalidación de rol vive en el middleware de auth)
const ALG = 'HS256';

export interface JwtPayload extends AuthUser {
  /**
   * Versión de sesión del usuario al firmar. Si no coincide con users.token_version
   * (que se incrementa al cambiar la contraseña), el token queda inválido.
   * Opcional por compatibilidad: tokens viejos sin el campo cuentan como versión 0.
   */
  tokenVersion?: number;
  exp: number;
  [key: string]: unknown;
}

export async function signToken(
  user: AuthUser,
  secret: string,
  tokenVersion: number,
): Promise<string> {
  const payload: JwtPayload = {
    ...user,
    tokenVersion,
    exp: Math.floor(Date.now() / 1000) + EXPIRY_SECONDS,
  };
  return sign(payload, secret, ALG);
}

export async function verifyToken(token: string, secret: string): Promise<JwtPayload> {
  return (await verify(token, secret, ALG)) as unknown as JwtPayload;
}
