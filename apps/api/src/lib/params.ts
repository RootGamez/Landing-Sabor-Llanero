import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { badRequest } from './http-error';

/**
 * Parsea un entero positivo desde un valor de query/param string potencialmente
 * indefinido o inválido (ej. "abc", "-3", "1.5"). Un `Number()` crudo sobre
 * ese valor llega a D1 como NaN y produce un 500 en vez de degradar con
 * gracia; acá cualquier valor no-entero/no-positivo/no-finito cae al fallback.
 */
export function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

/**
 * Exige que el :id (u otro param con nombre) de la ruta sea un entero
 * positivo. Sin esto, un id como "abc" llega a D1 como NaN y produce un 500
 * genérico en vez de un 400 explícito.
 */
export function requireIdParam(c: Context<AppEnv>, name = 'id'): number {
  const raw = c.req.param(name);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest(`${name} inválido`);
  }
  return parsed;
}
