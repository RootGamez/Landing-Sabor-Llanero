import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/siteConfig";

// Genera manifest.webmanifest en build time (necesario con output: "export").
export const dynamic = "force-static";

// Mismos valores que `--color-brand-blue` / `--color-cream` de globals.css:
// el manifest es JSON puro y no puede leer variables CSS.
const THEME_COLOR = "#00247d";
const BACKGROUND_COLOR = "#fdf8ef";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: siteConfig.fullName,
    short_name: "Sabor Llanero",
    description: siteConfig.description,
    lang: "es-PE",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: THEME_COLOR,
    background_color: BACKGROUND_COLOR,
    categories: ["food", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Capturas de la ficha de instalación (Chrome/PWABuilder). 1080×1920 = 9:16,
    // el formato de teléfono que también acepta Google Play.
    screenshots: [
      {
        src: "/screenshots/home.jpg",
        sizes: "1080x1920",
        type: "image/jpeg",
        form_factor: "narrow",
        label: "Inicio de Pizzería Sabor Llanero",
      },
      {
        src: "/screenshots/menu.jpg",
        sizes: "1080x1920",
        type: "image/jpeg",
        form_factor: "narrow",
        label: "Carta con fotos y precios",
      },
      {
        src: "/screenshots/promos.jpg",
        sizes: "1080x1920",
        type: "image/jpeg",
        form_factor: "narrow",
        label: "Promos especiales y pedido por WhatsApp",
      },
    ],
    // Accesos directos al mantener pulsado el ícono de la app (Android).
    shortcuts: [
      {
        name: "Ver la carta",
        short_name: "Carta",
        url: "/menu/?source=shortcut",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Mi carrito",
        short_name: "Carrito",
        url: "/carrito/?source=shortcut",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
