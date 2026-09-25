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

/**
 * JWT de clientes finales, deliberadamente separado del de staff (`JwtPayload`):
 * secret distinto (`CUSTOMER_JWT_SECRET`) y forma de payload distinta
 * (`customerId`, sin `role`). Así, aunque el middleware esté bien escrito, un
 * token de cliente no puede autenticar contra rutas de staff ni viceversa
 * incluso ante un bug futuro de guard — defensa en profundidad, no solo
 * "confiar en que el `if` de rol esté bien puesto". Ver PLAN_IMPLEMENTACION.md.
 */
export interface CustomerJwtPayload {
  customerId: number;
  email: string;
  /** Mismo mecanismo de revocación que `JwtPayload.tokenVersion`, contra `customers.token_version`. */
  tokenVersion?: number;
  exp: number;
  [key: string]: unknown;
}

export async function signCustomerToken(
  customer: { customerId: number; email: string },
  secret: string,
  tokenVersion: number,
): Promise<string> {
  const payload: CustomerJwtPayload = {
    ...customer,
    tokenVersion,
    exp: Math.floor(Date.now() / 1000) + EXPIRY_SECONDS,
  };
  return sign(payload, secret, ALG);
}

export async function verifyCustomerToken(token: string, secret: string): Promise<CustomerJwtPayload> {
  return (await verify(token, secret, ALG)) as unknown as CustomerJwtPayload;
}
