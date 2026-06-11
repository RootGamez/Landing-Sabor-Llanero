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

## ¿Dónde cambio cada cosa?

Toda la data vive en `lib/` — no hay nada hardcodeado en los componentes.

| Quiero cambiar… | Archivo |
|---|---|
| Imágenes del carrusel del hero (verticales 2:3) | `public/images/` + `lib/heroImages.ts` |
| Afiches de la galería (verticales 2:3) | `public/images/promos/` + `lib/galleryImages.ts` |
| Secuencia "Así nace tu pizza" (5 etapas) | `public/images/builder/etapa-1.png` … `etapa-5.png` + `lib/builderImages.ts` |
| Foto de la Pizza Alborada / tequeños / logo / video del local | `public/images/featured/`, `public/images/brand/`, `public/videos/` + rutas en `lib/siteConfig.ts` → `media` |
| Horarios (badge "Abierto ahora", footer y SEO) | `lib/businessHours.ts` — única fuente de verdad |
| Teléfono, WhatsApp y su mensaje pre-escrito | `lib/siteConfig.ts` |
| Dirección, coordenadas y link de Google Maps | `lib/siteConfig.ts` |
| Links de Instagram / Facebook / WhatsApp | `lib/siteConfig.ts` → `socials` |
| Dominio del sitio (SEO, sitemap) | `lib/siteConfig.ts` → `url` |
| Textos de la historia | `components/sections/About.tsx` |
| Precio e ingredientes de la Alborada | `components/sections/AlboradaFeature.tsx` |
| Textos de los tequeños | `components/sections/TequenosFeature.tsx` |

## Modelo 3D de la sección "Antójate en 360°"

El visor usa Three.js y espera el modelo en `public/models/pizza.glb`.
Si el archivo no existe, muestra la foto real como respaldo.

Para instalarlo: abre <https://poly.pizza/m/9IWGn64Fnqo>, pulsa
**Download → GLB** y guarda el archivo como `public/models/pizza.glb`.

> Crédito del modelo: "Pepperoni pizza" de **Poly by Google**,
> licencia [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/).
> La atribución ya está incluida aquí y en el código.

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
components/sections/  → Navbar, Hero, Features, About, PizzaBuilder,
                        AlboradaFeature, TequenosFeature, Gallery,
                        GoogleReviews, Footer
components/ui/        → carrusel, badge de horario, lightbox, partículas,
                        cursor glow, franja tricolor…
lib/                  → TODA la configuración del negocio
public/images/        → brand/ (logo) · featured/ (alborada, tequeños)
                        · promos/ (afiches) · builder/ (etapas)
public/videos/        → video del local
types/                → tipos TypeScript
```
