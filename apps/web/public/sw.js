/*
 * Service worker de Sabor Llanero (PWA instalable).
 *
 * Política deliberadamente conservadora — la carta, los precios, la sesión y
 * los pedidos NUNCA deben servirse desde caché:
 *   - Solo intercepta GET del mismo origen. La API (api.saborllanero.online)
 *     es otro origen, así que ni pasa por aquí.
 *   - Navegaciones (HTML): siempre red; si no hay internet, /offline.html.
 *   - /menu/item/* queda fuera: lo resuelve el Worker de Cloudflare (vista
 *     previa de WhatsApp + redirección) y no debe cachearse.
 *   - Estáticos con hash (/_next/static/) e íconos: cache-first (inmutables).
 *   - Imágenes de /images/: stale-while-revalidate.
 *   - /models y /videos no se tocan: son pesados y usan Range requests.
 *
 * Al cambiar la lógica, subir CACHE_VERSION para invalidar lo anterior.
 */
const CACHE_VERSION = "v1";
const STATIC_CACHE = `sabor-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `sabor-images-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";
// offline.html + el ícono que muestra, para que se vea completa sin internet.
const PRECACHE_URLS = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const current = new Set([STATIC_CACHE, IMAGE_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("sabor-") && !current.has(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isImmutableAsset(pathname) {
  return pathname.startsWith("/_next/static/") || pathname.startsWith("/icons/");
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.status === 200) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.status === 200) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached ?? (await network) ?? Response.error();
}

async function navigationWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    return (await cache.match(OFFLINE_URL)) ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/menu/item/")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationWithOfflineFallback(request));
    return;
  }

  if (isImmutableAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (url.pathname.startsWith("/images/")) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
  }
});
