# 🍕 Pizzería Sabor Llanero — Landing Page

Landing page oficial del negocio. **Next.js 15 + React 19 + TypeScript + Tailwind CSS 4.**

## Arranque

```bash
pnpm install
pnpm build
pnpm start   # producción en http://localhost:3000
```

Para desarrollo: `pnpm dev`.

> **Importante:** si cambias `next.config.ts`, reinicia el servidor de
> desarrollo (Ctrl+C y `pnpm dev` de nuevo) — Next no recarga la config.

## Placeholders de imágenes

Si las imágenes de muestra no cargan o se ven rotas, regenéralas en tu
máquina y reinicia el servidor:

```bash
node scripts/generate-placeholders.mjs
```

## ¿Dónde cambio cada cosa?

Toda la data vive en `lib/` — no hay nada hardcodeado en los componentes.

| Quiero cambiar… | Archivo |
|---|---|
| Fotos del carrusel del hero | Sube tus fotos a `public/images/hero/` (ideal `.webp`) y actualiza las rutas en `lib/heroImages.ts` |
| Fotos de la galería | `public/images/gallery/` + `lib/galleryImages.ts` |
| Foto de la sección Nosotros | `public/images/about/` + la ruta en `components/sections/About.tsx` |
| Horarios (badge "Abierto ahora", footer y SEO) | `lib/businessHours.ts` — única fuente de verdad |
| Teléfono, WhatsApp y su mensaje pre-escrito | `lib/siteConfig.ts` |
| Dirección, coordenadas y link de Google Maps | `lib/siteConfig.ts` |
| Links de Instagram / Facebook / WhatsApp | `lib/siteConfig.ts` → `socials` |
| Dominio del sitio (SEO, sitemap) | `lib/siteConfig.ts` → `url` |
| Textos de la historia | `components/sections/About.tsx` |

> Las imágenes actuales son **placeholders SVG** (vectoriales, nítidos en
> cualquier navegador). Cuando tengas fotos reales, súbelas en formato
> `.webp` o `.jpg` con el nombre que quieras y actualiza la ruta en el
> archivo de `lib/` correspondiente — `next/image` las optimiza solo.

## Reseñas de Google (Featurable)

El widget está en `components/sections/GoogleReviews.tsx` y carga las reseñas
reales de Google. Para mostrarlo como **carrusel automático**:

1. Entra a [featurable.com](https://featurable.com) con tu cuenta.
2. Abre tu widget → **Layout** → elige **Carousel** y activa el autoplay.
3. Guarda. No hay que tocar código: el cambio se refleja solo.

## Sección Menú (futuro)

Aún no existe carta online. El anchor `#menu` está reservado en
`app/page.tsx` (ver comentario) para montarla cuando esté lista.

## Deploy en VPS (Nginx + PM2)

```bash
pnpm install && pnpm build
pm2 start pnpm --name sabor-llanero -- start   # sirve en el puerto 3000
```

Apunta Nginx con `proxy_pass http://localhost:3000;`. No depende de Vercel.

## Estructura

```
app/                  → layout (SEO + JSON-LD), página, sitemap, robots
components/sections/  → Navbar, Hero, About, Gallery, GoogleReviews, Footer
components/ui/        → carrusel, badge de horario, lightbox, franja tricolor…
lib/                  → TODA la configuración del negocio
types/                → tipos TypeScript
```
