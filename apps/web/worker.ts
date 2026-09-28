import { formatPrice, type MenuItemDetail } from "@sabor/shared";

/**
 * Worker de Cloudflare (BLUEPRINT: vista previa de producto en WhatsApp). El
 * proyecto en Cloudflare es "Workers con assets estáticos" (Settings → Builds
 * → Deploy command: `npx wrangler deploy`), NO Cloudflare Pages — así que la
 * carpeta `functions/` (convención exclusiva de Pages) no sirve acá; esto es
 * lo que realmente intercepta requests en este tipo de proyecto.
 *
 * `wrangler.jsonc` solo invoca este Worker para `/menu/item/*`
 * (`run_worker_first`) — todo lo demás lo sirve Cloudflare directo desde
 * `assets` sin pasar por acá, cero cambio de latencia/costo para el resto
 * del sitio.
 *
 * El sitio es 100% export estático (`output: "export"`), así que el link que
 * antes se mandaba por WhatsApp — `/menu/#item-slug` — es un ancla: el
 * crawler de WhatsApp nunca la ve (los fragmentos nunca viajan al servidor),
 * así que todo producto compartía la misma vista previa genérica de /menu (o
 * ninguna). Esta ruta resuelve el ítem contra la API pública en tiempo real y
 * devuelve HTML con Open Graph reales (foto, nombre, precio) — siempre al día
 * con el CMS, sin rebuild. Un visitante real (o el propio crawler, que no
 * ejecuta el redirect) cae acá un instante; el <head> ya tiene todo lo que
 * necesita el unfurling y el body redirige de inmediato al ítem real dentro
 * de /menu.
 *
 * `lib/whatsapp.ts` arma el `[link]` del mensaje apuntando acá
 * (`/menu/item/{slug}`) en vez de al ancla.
 */

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: Fetcher;
  API_BASE_URL?: string;
}

const DEFAULT_API_BASE_URL = "https://api.saborllanero.online";
const FALLBACK_IMAGE = "https://saborllanero.online/images/featured/pizza-alborada.jpg";
const SITE_NAME = "Pizzería Sabor Llanero";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function priceDescription(item: MenuItemDetail): string {
  if (item.category.hasSizes && item.prices.length > 0) {
    const min = Math.min(...item.prices.map((p) => p.price));
    return `Desde ${formatPrice(min)} · ${SITE_NAME}`;
  }
  if (item.price != null) return `${formatPrice(item.price)} · ${SITE_NAME}`;
  return SITE_NAME;
}

function coverImageUrl(item: MenuItemDetail, apiBaseUrl: string): string {
  const cover = item.media.find((m) => m.type === "image");
  return cover ? `${apiBaseUrl}/api/media/${cover.r2Key}` : FALLBACK_IMAGE;
}

function renderShareHtml(item: MenuItemDetail, origin: string, apiBaseUrl: string): string {
  const pageUrl = `${origin}/menu/item/${item.slug}`;
  const targetUrl = `${origin}/menu/#item-${item.slug}`;
  const title = escapeHtml(item.nameEs);
  const description = escapeHtml(priceDescription(item));
  const image = coverImageUrl(item, apiBaseUrl);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | ${SITE_NAME}</title>
<meta property="og:type" content="product">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${pageUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="description" content="${description}">
<link rel="canonical" href="${pageUrl}">
<meta http-equiv="refresh" content="0; url=${targetUrl}">
<script>location.replace(${JSON.stringify(targetUrl)});</script>
<style>
  body { margin:0; min-height:100dvh; display:flex; align-items:center; justify-content:center;
    background:#fdf6e9; font-family:system-ui,sans-serif; color:#00247d; text-align:center; padding:24px; }
  a { color:#cf142b; font-weight:600; }
</style>
</head>
<body>
  <p>Abriendo ${title} en la carta… si no pasa nada, <a href="${targetUrl}">tocá acá</a>.</p>
</body>
</html>`;
}

async function handleItemShare(slug: string, origin: string, env: Env): Promise<Response> {
  const apiBaseUrl = (env.API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");

  let item: MenuItemDetail | undefined;
  try {
    const res = await fetch(`${apiBaseUrl}/api/menu-items/${encodeURIComponent(slug)}`);
    if (res.ok) item = await res.json();
  } catch {
    // Falla de red hacia la API: se degrada al mismo fallback que un 404 —
    // nunca deja al visitante (o al crawler) con un error crudo.
  }

  // Ítem inexistente/inactivo o API caída: no hay nada que unfurlear, se
  // manda directo a la carta en vez de mostrar una vista previa vacía.
  if (!item) return Response.redirect(`${origin}/menu/`, 302);

  return new Response(renderShareHtml(item, origin, apiBaseUrl), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Corto a propósito: un cambio de foto/precio en el CMS tarda como
      // mucho esto en reflejarse en un link ya compartido.
      "cache-control": "public, max-age=300",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const match = /^\/menu\/item\/([^/]+)\/?$/.exec(url.pathname);
    if (match) return handleItemShare(decodeURIComponent(match[1]!), url.origin, env);
    return env.ASSETS.fetch(request);
  },
};
