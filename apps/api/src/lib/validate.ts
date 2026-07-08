import type { Context } from 'hono';
import type { z } from 'zod';
import type { AppEnv } from '../env';
import { badRequest } from './http-error';

/**
 * Lee y valida el body JSON contra un esquema Zod.
 * - JSON malformado -> 400 (antes caía en el onError como 500).
 * - Falla de validación -> 400 con la primera issue (campo: mensaje).
 * Devuelve el dato ya parseado y tipado.
 */
export async function parseBody<S extends z.ZodType>(
  c: Context<AppEnv>,
  schema: S,
): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw badRequest('Cuerpo JSON inválido');
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join('.') || 'body';
    throw badRequest(`${path}: ${first?.message ?? 'valor inválido'}`);
  }
  return result.data;
}
