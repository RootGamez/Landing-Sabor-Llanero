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

## Back-office (CMS)

Panel de gestión para el dueño, administradores y cajeros. Módulos:

- **POS** (`/ventas/pos`) — Punto de venta: catálogo, ticket, cobro, anular
- **Cierres** (`/ventas/cierres`) — Arqueo de caja con PNG descargable
- **Gastos** (`/gastos`) — Registro y listado de egresos con expresiones (`15+5`)
- **Importar HomeBank** (`/gastos/importar`) — Carga de `.xhb`/`.csv` idempotente
- **Dashboard** (`/`) — KPIs, ingresos vs egresos, top productos (solo owner/admin)
- **Ajustes** — Menú, categorías, usuarios, perfil

### Comandos

```bash
make cms                # CMS en modo dev (:5174)
make dev                # api + web + cms juntos
make e2e-cms            # Suite E2E del CMS (Playwright, base aislada)
make create-owner EMAIL=x@x.com PASSWORD=abc NAME="Nombre"
```

### Importar HomeBank

Ve a Gastos → Importar → sube tu `.xhb` o `.csv`. Los datos reales (`pos.db`,
`.xhb`) nunca se commitean. Reimportar el mismo archivo da 0 duplicados.

### Importar Aronium (F8 — pendiente)

Requiere el backup actualizado de `pos.db` de Aronium. Contactar al dueño.

---

## Documentación

- [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) — arquitectura completa (catálogo,
  CMS, API, D1) y fases del refactor.
- [`docs/PLAN_IMPLEMENTACION.md`](docs/PLAN_IMPLEMENTACION.md) — plan de
  ejecución vivo (seguridad de cuentas admin, carrito, puntos y sorteo). Se
  actualiza fase por fase a medida que se implementa.
- [`docs/PLAN_BACKOFFICE.md`](docs/PLAN_BACKOFFICE.md) — plan de fases del
  back-office (F1–F10), criterios de aceptación y registro de cambios.
- [`apps/web/README.md`](apps/web/README.md) — guía de la landing actual.
