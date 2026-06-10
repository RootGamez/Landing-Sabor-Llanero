import type { NextConfig } from "next";

// Configuración pensada para deploy en VPS propia (Nginx + PM2), sin features de Vercel.
const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  poweredByHeader: false,
};

export default nextConfig;
