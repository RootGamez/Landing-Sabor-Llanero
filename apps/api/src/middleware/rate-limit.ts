import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv, Bindings, RateLimit } from '../env';
import { tooManyRequests } from '../lib/http-error';

/** IP del cliente detrás de Cloudflare; 'unknown' si no viene el header. */
export function clientIp(c: Context<AppEnv>): string {
  return c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
}

/**
 * Middleware de rate limiting basado en el binding nativo de Cloudflare.
 * Si el binding no está configurado (dev local), degrada a no-op para no
 * romper el flujo. `selectBinding` elige cuál limitador usar; `buildKey`
 * arma la clave de conteo (por defecto, la IP del cliente).
 */
export function rateLimit(
  selectBinding: (env: Bindings) => RateLimit | undefined,
  buildKey: (c: Context<AppEnv>) => string = clientIp,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const limiter = selectBinding(c.env);
    if (limiter) {
      const { success } = await limiter.limit({ key: buildKey(c) });
      if (!success) throw tooManyRequests();
    }
    await next();
  };
}
