# 🍕 Sabor Llanero — Monorepo

Landing page (y, en fases siguientes, catálogo + CMS) de Pizzería Sabor Llanero.
Monorepo pnpm modelado sobre la arquitectura de **Jaw-Project** — ver
[`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) para el plan completo y las decisiones
de diseño.

## Estructura

```
apps/
  web/    → landing pública (Next.js 15, output: "export"). Ver apps/web/README.md.
  api/    → (fase 3, ver docs/BLUEPRINT.md §6) — Worker Hono + D1 + R2.
  cms/    → (fase 4, ver docs/BLUEPRINT.md §6) — panel de administración.
packages/
  shared/ → (fase 2, ver docs/BLUEPRINT.md §6) — tipos, DTOs, lógica de dominio.
```

Hoy el repo solo contiene `apps/web`; el resto se agrega incrementalmente según
las fases descritas en el blueprint.

## Arranque

```bash
pnpm install
make web          # o: pnpm --filter @sabor/web dev
```

Ver `make help` para el resto de comandos, y
[`apps/web/README.md`](apps/web/README.md) para el detalle de la landing
(dónde cambiar imágenes, textos, horarios, deploy, etc.).

## Comandos principales

```bash
pnpm install          # dependencias del monorepo
make web              # landing en modo dev (:3000)
make build-web        # genera apps/web/out (export estático)
make typecheck        # tsc --noEmit en todos los paquetes
make clean             # borra node_modules/.next/out/.wrangler
```

## Documentación

- [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) — arquitectura completa (catálogo,
  CMS, API, D1) y fases del refactor.
- [`apps/web/README.md`](apps/web/README.md) — guía de la landing actual.
