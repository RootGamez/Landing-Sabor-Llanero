import type { Role } from '@sabor/shared';

/**
 * Binding nativo de Rate Limiting de Cloudflare Workers.
 * El tipo aún no viene en @cloudflare/workers-types, se declara acá.
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
}

/** Datos del usuario autenticado, adjuntados al contexto por el middleware de auth */
export interface AuthUser {
  id: number;
  email: string;
  role: Role;
}

export interface Variables {
  user: AuthUser;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
