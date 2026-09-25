import type { Role } from '@sabor/shared';

/**
 * Binding nativo de Rate Limiting de Cloudflare Workers.
 * El tipo aún no viene en @cloudflare/workers-types, se declara acá.
 * Ver: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
 */
export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * Binding nativo de Cloudflare Email Sending. El tipo aún no viene en
 * @cloudflare/workers-types@^4.20241127.0 (producto 2025, posterior a esa
 * versión), se declara acá con el mismo criterio que `RateLimit` — solo la
 * forma que este repo usa, no la API completa.
 * Ver: https://developers.cloudflare.com/email-service/
 */
export interface SendEmail {
  send(message: {
    to: string | string[];
    from: string | { email: string; name?: string };
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
  }): Promise<{ messageId: string }>;
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
  /** Envío de forgot-password (P1.4). Requiere el dominio habilitado en Cloudflare Email Sending. */
  EMAIL?: SendEmail;
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
