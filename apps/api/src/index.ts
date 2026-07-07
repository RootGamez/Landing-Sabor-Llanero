import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv, Bindings } from './env';
import { HttpError } from './lib/http-error';

import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { sizeRoutes } from './routes/sizes';
import { categoryRoutes } from './routes/categories';
import { menuItemRoutes } from './routes/menu-items';
import { collectionRoutes } from './routes/collections';
import { itemMediaRoutes, mediaRoutes } from './routes/media';
import { whatsappRoutes } from './routes/whatsapp';
import { eventRoutes } from './routes/events';
import { reportRoutes } from './routes/reports';

const app = new Hono<AppEnv>().basePath('/api');

/**
 * Orígenes permitidos por CORS. En producción se toman de WEB_ORIGIN/CMS_ORIGIN
 * (vars de wrangler); cada una acepta varios orígenes separados por coma
 * (útil mientras conviven el dominio *.pages.dev/*.workers.dev de prueba y el
 * definitivo). En desarrollo se agregan los puertos locales: la landing corre
 * en Next (:3000) y el futuro CMS reusará los puertos Vite típicos (:5173/:5174).
 */
function allowedOrigins(env: Bindings): string[] {
  const list = [env.WEB_ORIGIN, env.CMS_ORIGIN]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(','))
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (env.ENVIRONMENT === 'development') {
    list.push('http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174');
  }
  return list;
}

/**
 * Guard de configuración: en producción, si faltan JWT_SECRET o los orígenes
 * CORS, es preferible fallar explícito con 500 que operar mal configurado
 * (JWT sin secret o la web/el futuro CMS bloqueados en silencio por CORS).
 */
app.use('*', async (c, next) => {
  if (c.env.ENVIRONMENT === 'production') {
    if (!c.env.JWT_SECRET) {
      return c.json({ error: 'Configuración inválida: falta JWT_SECRET' }, 500);
    }
    if (allowedOrigins(c.env).length === 0) {
      return c.json({ error: 'Configuración inválida: faltan WEB_ORIGIN/CMS_ORIGIN' }, 500);
    }
    if (!c.env.LOGIN_LIMITER || !c.env.EVENTS_LIMITER) {
      return c.json({ error: 'Configuración inválida: faltan LOGIN_LIMITER/EVENTS_LIMITER' }, 500);
    }
  }
  await next();
});

// Headers de seguridad en todas las respuestas del API (nosniff, no-frame, etc.).
app.use('*', secureHeaders({ crossOriginResourcePolicy: false }));

app.use('*', (c, next) =>
  cors({
    origin: (origin) => {
      const allowed = allowedOrigins(c.env);
      return allowed.includes(origin) ? origin : null;
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })(c, next),
);

app.route('/auth', authRoutes);
app.route('/users', userRoutes);
app.route('/sizes', sizeRoutes);
app.route('/categories', categoryRoutes);
app.route('/menu-items', menuItemRoutes);
app.route('/menu-items', itemMediaRoutes); // /menu-items/:id/media
app.route('/collections', collectionRoutes);
app.route('/media', mediaRoutes);
app.route('/whatsapp', whatsappRoutes);
app.route('/events', eventRoutes);
app.route('/reports', reportRoutes);

app.notFound((c) => c.json({ error: 'Ruta no encontrada' }, 404));

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status);
  }
  // Backstop para violaciones de constraint de D1 (carreras TOCTOU en slug/email,
  // FK inválida): traducir a 4xx en vez de un 500 genérico.
  const message = err instanceof Error ? err.message : '';
  if (message.includes('UNIQUE constraint failed')) {
    return c.json({ error: 'Ya existe un registro con esos datos' }, 409);
  }
  if (message.includes('FOREIGN KEY constraint failed') || message.includes('constraint failed')) {
    return c.json({ error: 'Datos inválidos o referencia inexistente' }, 400);
  }
  console.error(err);
  return c.json({ error: 'Error interno del servidor' }, 500);
});

export default app;
