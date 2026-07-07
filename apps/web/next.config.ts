import type { NextConfig } from "next";

// Export estático: el sitio es 100% estático (sin API routes, Server Actions ni
// SSR en runtime), así que `next build` genera la carpeta `out/` que sirve
// Cloudflare Pages directo como CDN. También funciona en VPS (Nginx) o cualquier
// hosting estático. Para volver a SSR con `next start`, quita `output: "export"`.
const nextConfig: NextConfig = {
  output: "export",
  images: {
    // En export estático no hay servidor que optimice imágenes: next/image
    // se renderiza como <img> normal sirviendo los archivos tal cual.
    unoptimized: true,
  },
  // Rutas con barra final (/sobre/) → estructura de carpetas estable en CF Pages.
  trailingSlash: true,
  poweredByHeader: false,
};

export default nextConfig;
