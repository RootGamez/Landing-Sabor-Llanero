import type { Context } from 'hono';
import type { MenuChannel } from '@sabor/shared';
import type { AppEnv } from '../env';
import { authenticate } from '../middleware/auth';
import { badRequest } from './http-error';

/** Alcance pedido por el cliente: la tienda online (por defecto), el mostrador o ambos (CMS). */
type ChannelScope = 'web' | 'pos' | 'all';

const SCOPE_CHANNELS: Record<ChannelScope, readonly MenuChannel[]> = {
  web: ['both', 'web'],
  pos: ['both', 'pos'],
  all: ['both', 'web', 'pos'],
};

const isChannelScope = (value: string): value is ChannelScope => value in SCOPE_CHANNELS;

/** Canales visibles en la tienda online y en colecciones públicas (D6). */
export const WEB_CHANNELS = SCOPE_CHANNELS.web;

/**
 * Canales de `menu_items` que una petición puede ver (`?channel=web|pos|all`).
 * El público solo ve la web: pedir `pos` o `all` exige sesión de staff (401 si
 * no la hay), así el catálogo solo-mostrador nunca se filtra a la web.
 */
export async function requestedChannels(c: Context<AppEnv>): Promise<readonly MenuChannel[]> {
  const raw = c.req.query('channel') ?? 'web';
  if (!isChannelScope(raw)) throw badRequest('channel inválido: debe ser web, pos o all');
  if (raw !== 'web') await authenticate(c);
  return SCOPE_CHANNELS[raw];
}

/** Fragmento SQL `<column> IN (?, ?)` y sus parámetros, para armar condiciones dinámicas. */
export function channelCondition(
  channels: readonly MenuChannel[],
  column = 'channel',
): { sql: string; params: string[] } {
  return { sql: `${column} IN (${channels.map(() => '?').join(',')})`, params: [...channels] };
}
