import type { NextConfig } from "next";

// Configuración pensada para deploy en VPS propia (Nginx + PM2), sin features de Vercel.
const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    // Permite servir los placeholders SVG locales vía next/image de forma segura
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  poweredByHeader: false,
};

export default nextConfig;
