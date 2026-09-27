import { formatPrice, type MenuItemDetail } from "@sabor/shared";

/**
 * Cloudflare Pages Function (BLUEPRINT: vista previa de producto en
 * WhatsApp). El sitio es 100% export estático (`output: "export"`), así que
 * el link que hoy se manda por WhatsApp — `/menu/#item-slug` — es un ancla:
 * el crawler de WhatsApp nunca la ve (los fragmentos nunca viajan al
 * servidor), así que todo producto comparte la misma vista previa genérica
 * de /menu (o ninguna).
 *
 * Esta ruta SÍ corre en el edge (Pages Functions, no export estático):
 * resuelve el ítem contra la API pública en tiempo real y devuelve HTML con
 * Open Graph reales (foto, nombre, precio) — siempre al día con el CMS, sin
 * rebuild. Un visitante real (o el propio crawler, que no ejecuta el
 * redirect) cae acá un instante; el <head> ya tiene todo lo que necesita el
 * unfurling y el body redirige de inmediato al ítem real dentro de /menu.
 *
 * `lib/whatsapp.ts` arma el `[link]` del mensaje apuntando acá
 * (`/menu/item/{slug}`) en vez de al ancla.
 */

interface PagesContext {
  params: { slug?: string | string[] };
  request: Request;
  env?: { API_BASE_URL?: string };
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

/** Página de redirect con Open Graph reales, o null si el ítem no existe/no está activo. */
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

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const slug = Array.isArray(context.params.slug) ? context.params.slug[0] : context.params.slug;
  const origin = new URL(context.request.url).origin;
  const apiBaseUrl = (context.env?.API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");

  if (!slug) return Response.redirect(`${origin}/menu/`, 302);

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
