import type { Role } from '@sabor/shared';

/**
 * Binding nativo de Rate Limiting de Cloudflare Workers.
 * El tipo aún no viene en @cloudflare/workers-types, se declara aquí.
 * Ver: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
 */
export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Bindings de Cloudflare declarados en wrangler.toml */
export interface Bindings {
  DB: D1Database;
  MEDIA: R2Bucket;
  JWT_SECRET: string;
  ENVIRONMENT: string;
  /** Orígenes permitidos por CORS en producción (el de apps/web y, más adelante, apps/cms). */
  WEB_ORIGIN?: string;
  CMS_ORIGIN?: string;
  /**
   * Limitadores de tasa opcionales. Si el binding no está configurado
   * (p. ej. en dev local sin la config), el middleware degrada a no-op.
   */
  LOGIN_LIMITER?: RateLimit;
  EVENTS_LIMITER?: RateLimit;
  /**
   * Emails transaccionales vía la Lambda de AWS (apps/mailer), ver `lib/mailer.ts`.
   * Son secrets (`wrangler secret put`); `MAIL_LAMBDA_SECRET` es el mismo
   * valor que `SIGNING_SECRET` en la Lambda. Sin ellos (dev local) no se envía nada.
   */
  MAIL_LAMBDA_URL?: string;
  MAIL_LAMBDA_SECRET?: string;
  /** Secret separado del `JWT_SECRET` de staff (P2.2) — ver `lib/jwt.ts`. */
  CUSTOMER_JWT_SECRET: string;
  CUSTOMER_AUTH_LIMITER?: RateLimit;
}

/** Datos del usuario autenticado, adjuntados al contexto por el middleware de auth */
export interface AuthUser {
  id: number;
  email: string;
  role: Role;
}

/** Datos del cliente autenticado (namespace separado de `AuthUser`, sin `role`). */
export interface AuthCustomer {
  id: number;
  email: string;
}

export interface Variables {
  user: AuthUser;
  customer: AuthCustomer;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
