# Plan de Implementación — Sabor Llanero

Documento vivo de ejecución. Complementa a [`BLUEPRINT.md`](./BLUEPRINT.md) (arquitectura
de referencia): éste es el plan de trabajo fase por fase, con su estado actualizado.

> ## Instrucciones para Claude — leer siempre antes de tocar código en este plan
>
> 1. **Este archivo es el estado vivo de la implementación.** Antes de empezar a trabajar,
>    releé la tabla "Estado general" y la fase específica que vas a implementar (no asumas
>    contexto de una conversación anterior — este archivo debe alcanzar por sí solo).
> 2. **Al completar una fase**: marcá su checkbox, cambiá su estado en la tabla de "Estado
>    general" a `✅ Completada` con la fecha, y agregá una fila en "Registro de cambios" (al
>    final del archivo) describiendo qué se hizo y cualquier desvío respecto de lo planeado
>    acá. No sigas a la fase siguiente sin dejar esto actualizado — así cualquier sesión
>    nueva de Claude puede retomar el trabajo leyendo solo este documento.
> 3. **Skills/agentes obligatorios por fase**: cada fase lista qué correr antes/durante/después
>    de escribirla en su fila "Skills/Agentes". Regla general fija (no repetida en cada fase):
>    - Toda fase que crea o modifica UI en `apps/web` o `apps/cms` → correr el skill
>      **`ui-ux-pro-max`** ANTES de escribir el componente/página, y el agente
>      **`ecc:react-reviewer`** DESPUÉS de escribirlo.
>    - Toda fase que toca autenticación, dinero/puntos, o datos de usuarios/clientes → correr
>      el agente **`ecc:security-reviewer`** antes de dar la fase por terminada (regla ya
>      fijada en las reglas globales del usuario, `security.md`).
>    - Toda fase que agrega o cambia código → el agente **`ecc:code-reviewer`** al terminar
>      (regla global ya fijada, no es específica de este proyecto).
>    - Toda fase con una migración SQL nueva → el skill **`ecc:database-migrations`** antes de
>      escribirla.
>    - Ver la tabla completa en "Skills y agentes ECC" más abajo para los casos puntuales
>      (Cloudflare Email Service, Workers, accesibilidad, etc.).
> 4. **Si la realidad diverge del plan** (un archivo se llama distinto, un patrón cambió,
>    etc.), actualizá la sección de esa fase para que el documento siga siendo verdad, no
>    dejes que quede desactualizado como pasó con el header de `packages/shared/src/dto.ts`
>    (todavía dice "aún no implementada — fase 3", ya obsoleto).
> 5. No se escribe código de una fase sin que el usuario haya confirmado el plan (o esa fase
>    puntual) explícitamente — ver la sección de confirmación al pie de cada entrega en el
>    chat. Este archivo no reemplaza esa confirmación.

## Cómo leer este documento

Leyenda de estado: `⬜ Pendiente` · `🔄 En curso` · `✅ Completada` · `⚠️ Bloqueada`

Dos partes, pensadas para ejecutarse **en orden** (Parte 1 antes que Parte 2) porque ambas
tocan los mismos archivos compartidos (`env.ts`, `wrangler.toml`, `index.ts`) y numeran
migraciones/namespaces de forma correlativa — ver "Decisiones de integración" para el porqué
exacto. Dentro de cada parte, las fases también son secuenciales salvo que se indique lo
contrario.

## Estado general

| Fase | Área | Descripción corta | Depende de | Estado | Completada el |
|---|---|---|---|---|---|
| P1.1 | CMS | Editar usuario (CRUD completo del panel) | — | ✅ Completada | 2026-09-24 |
| P1.2 | API/DB | Migración `password_reset_tokens` | — | ✅ Completada | 2026-09-24 |
| P1.3 | API | Binding de email (Cloudflare Email Sending) | P1.2 | ⚠️ Bloqueada (falta acción manual) | |
| P1.4 | API | Endpoints forgot/reset-password | P1.2, P1.3 | ✅ Completada (código; envío real pendiente de P1.3) | 2026-09-24 |
| P1.5 | CMS | Pantallas de recuperación de contraseña | P1.4 | ✅ Completada | 2026-09-24 |
| P1.6 | API | Tests de la superficie nueva de auth | P1.4 | ✅ Completada | 2026-09-25 |
| P2.1 | API/DB | Migración `loyalty` + tipos/schemas compartidos | P1.2 | ✅ Completada | 2026-09-24 |
| P2.2 | API | Auth de clientes (`customers`, JWT separado) | P2.1 | ✅ Completada | 2026-09-24 |
| P2.3 | API | Pedidos (`orders`) + confirmación atómica | P2.2 | ✅ Completada | 2026-09-24 |
| P2.4 | API | Premios, sorteo y config de puntos | P2.3 | ✅ Completada | 2026-09-24 |
| P2.5 | CMS | Página "Pedidos" | P2.3 | ✅ Completada | 2026-09-24 |
| P2.6 | CMS | Páginas "Premios" / "Sorteo" / config de puntos | P2.4 | ✅ Completada | 2026-09-25 |
| P2.7 | Web | Carrito (funciona sin cuenta) | — | ✅ Completada | 2026-09-25 |
| P2.8 | Web | Cuenta de cliente + checkout logueado | P2.2, P2.3, P2.7 | ✅ Completada | 2026-09-25 |

---

## Parte 1 — Seguridad de cuentas admin, CRUD completo y recuperación de contraseña

### Contexto

Las únicas cuentas con login hoy son las de `users` (roles `owner`/`admin`, panel CMS) — no
existe ni existirá en esta parte ningún login para clientes finales (eso es la Parte 2). Auditoría
ya hecha sobre el código real (`routes/auth.ts`, `routes/users.ts`, `lib/password.ts`,
`middleware/auth.ts`, `migrations/0001_init.sql`):

- **Inyección SQL**: ya resuelto, 100% de las queries parametrizadas (`.bind()`).
- **Contraseñas legibles**: ya resuelto, PBKDF2-HMAC-SHA256 100k iteraciones + salt random +
  comparación timing-safe. No son recuperables, solo verificables.
- **Gaps reales encontrados**: (1) `UsersPage.tsx` solo tiene Crear/Listar/Eliminar, falta
  Editar aunque el backend (`PATCH /users/:id`) ya lo soporta completo; (2) no existe
  recuperación de contraseña por email (solo "cambiar sabiendo la actual").

### P1.1 — CRUD completo de usuarios en el panel (Editar)

- **Estado**: ✅ Completada (2026-09-24)
- **Archivos**: `apps/cms/src/pages/UsersPage.tsx` (UPDATE). Sin cambios de API — `PATCH
  /users/:id` ya existe completo en `apps/api/src/routes/users.ts:40-80`.
- **Acción**: agregar botón "Editar" por fila que abre un `Dialog` (nombre, rol, contraseña
  nueva opcional) y envía `api.patch('/users/:id', {...})`.
- **Espejar**: `components/ui/dialog.tsx` (ya existe, Radix); patrón `useMutation` +
  `toastSuccess`/`toastError` que ya usa el formulario de creación en la misma página.
- **Skills/Agentes**: `ui-ux-pro-max` antes de maquetar el modal · `ecc:react-reviewer` después.
- **Validar**: `pnpm typecheck`; manual: crear → editar nombre/rol/contraseña → intentar
  degradar al último owner (debe rechazar con 409, ya cubierto por el backend).

### P1.2 — Migración: tokens de recuperación de contraseña

- **Estado**: ✅ Completada (2026-09-24)
- **Archivo**: `apps/api/migrations/0003_password_reset_tokens.sql` (CREATE)
- **Skills/Agentes**: `ecc:database-migrations` antes de escribirla.

```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,   -- nunca se guarda el token crudo, solo su hash SHA-256
  expires_at TEXT NOT NULL,
  used_at    TEXT,                   -- NULL = todavía válido; de un solo uso
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);
```

- **Validar**: `wrangler d1 migrations apply sabor-llanero --local`.

### P1.3 — Envío de email: Cloudflare Email Sending (no SMTP tradicional)

- **Estado**: ⚠️ Bloqueada — código listo, falta la habilitación real del dominio (acción
  manual del dueño de la cuenta Cloudflare, no ejecutable por Claude).
- **Hecho (2026-09-24)**: binding `[[send_email]]` en `wrangler.toml` (dev y
  `[env.production]`, `remote = true`), tipo `SendEmail` agregado a mano en `env.ts` (mismo
  criterio que `RateLimit`), guard de producción en `index.ts` extendido con `EMAIL`.
  `pnpm typecheck` en `@sabor/api` pasa.
- **Desvío del plan original**: el skill `cloudflare-email-service` (retrieval, no
  conocimiento pre-entrenado) confirma que la API vigente 2025 es `env.EMAIL.send({ to, from,
  subject, html, text })` — mucho más simple que un `EmailMessage`/MIME manual. El tipo
  `SendEmail` en `env.ts` ya refleja esto.
- **Pendiente — acción manual del usuario** (no se puede automatizar desde acá, requiere login
  a la cuenta real de Cloudflare y acceso al DNS del dominio):
  ```bash
  npx wrangler email sending enable saborllanero.online
  npx wrangler email sending dns get saborllanero.online   # confirma SPF/DKIM, propaga 5-15 min
  ```
  Una vez habilitado, retomar esta fase para escribir el envío real en P1.4 y validar con
  `wrangler dev` (`remote: true`) mandando un email de prueba a una casilla real propia.
- **Archivos**: `apps/api/wrangler.toml` (UPDATE), `apps/api/src/env.ts` (UPDATE),
  `apps/api/src/index.ts` (UPDATE, guard de config).
- **Acción**: no hace falta SMTP con usuario/contraseña — Cloudflare tiene un binding nativo
  sin API keys. Setup de dominio (una vez, fuera de código):
  ```bash
  npx wrangler email sending enable saborllanero.online
  npx wrangler email sending dns get saborllanero.online   # confirma SPF/DKIM
  ```
  `wrangler.toml`, en el bloque dev **y** en `[env.production]` (los envs de wrangler no
  heredan bindings — ver "Decisiones de integración"):
  ```toml
  [[send_email]]
  name = "EMAIL"
  remote = true   # no hay emulador local; se prueba contra el servicio real (igual que MEDIA/R2)

  [[env.production.send_email]]
  name = "EMAIL"
  ```
  `env.ts`: agregar `EMAIL: SendEmail` a `Bindings` — a mano (mismo criterio ya usado ahí
  para `RateLimit`, porque `@cloudflare/workers-types@^4.20241127.0` es anterior al
  lanzamiento 2025 de Email Sending) o regenerando tipos si se actualiza esa dependencia.
  `index.ts`: sumar `EMAIL` al guard de configuración de producción (línea ~63, junto a
  `LOGIN_LIMITER`/`EVENTS_LIMITER`).
- **Skills/Agentes**: `cloudflare-email-service` (obligatorio, producto de 2025, no confiar en
  conocimiento pre-entrenado) · `workers-best-practices` · `wrangler` para la sintaxis de CLI.
- **Validar**: `wrangler dev` con `remote: true` y mandar un email de prueba a una casilla real
  propia antes de dar la fase por terminada.

### P1.4 — Endpoints `forgot-password` / `reset-password`

- **Estado**: ✅ Completada (2026-09-24) — código y typecheck OK; el envío real de email
  sigue bloqueado por P1.3 (falta habilitar Email Sending en Cloudflare).
- **Archivos**: `apps/api/src/routes/auth.ts` (UPDATE), `apps/api/src/lib/reset-token.ts`
  (CREATE), `packages/shared/src/validation.ts` (UPDATE), `packages/shared/src/dto.ts` (UPDATE).
- **Acción**:
  - `lib/reset-token.ts`: generar token (32 bytes random → base64url) + hashearlo (SHA-256),
    mismo estilo Web-Crypto-only que `lib/password.ts`.
  - `POST /auth/forgot-password` (rate-limited con `LOGIN_LIMITER`, público): invalida tokens
    viejos del usuario + limpia expirados globales, crea uno nuevo (30 min), despacha el email
    vía `c.executionCtx.waitUntil(...)`. **Responde siempre igual** exista o no la cuenta
    (`200 { message: "..." }`) — mismo principio anti-enumeración que ya usa `/login`.
  - `POST /auth/reset-password` (rate-limited, público): reclama el token de forma atómica
    (`UPDATE password_reset_tokens SET used_at = datetime('now') WHERE token_hash = ? AND
    used_at IS NULL AND expires_at > datetime('now') RETURNING user_id` — un solo statement,
    mismo idiom que el guard de "último owner" en `routes/users.ts`), luego actualiza
    `password_hash` + incrementa `token_version` (revoca sesiones viejas). Inválido/expirado →
    `400` genérico, sin distinguir motivo.
  - Reusar `LOGIN_LIMITER` en vez de pedir un namespace nuevo (ver "Decisiones de integración").
- **Skills/Agentes**: `ecc:security-review` (checklist de token: entropía, hash, expiración,
  un solo uso, anti-enumeración) · `workers-best-practices` (`crypto.getRandomValues`, no
  `Math.random`) · `ecc:security-reviewer` (agente) antes de cerrar la fase.
- **Validar**: probar con curl/Postman: token válido cambia la contraseña e invalida sesiones
  viejas; token vencido/usado/inventado → 400; email inexistente → mismo 200 que uno existente.

### P1.5 — Pantallas de recuperación en el CMS

- **Estado**: ✅ Completada (2026-09-24)
- **Archivos**: `apps/cms/src/pages/ForgotPasswordPage.tsx` (CREATE),
  `apps/cms/src/pages/ResetPasswordPage.tsx` (CREATE), `apps/cms/src/pages/LoginPage.tsx`
  (UPDATE, link), `apps/cms/src/App.tsx` (UPDATE, 2 rutas **fuera** de `Protected`).
- **Espejar**: layout/estilo de `LoginPage.tsx`; `api.post` + `useMutation` funcionan sin
  sesión porque `lib/api.ts` solo agrega `Authorization` si hay token en el store.
- **Importante**: el link del email trae el token en el fragment (`#token=...`), no en
  query string (`?token=`) — así nunca viaja al servidor ni queda expuesto en un header
  Referer. `ResetPasswordPage.tsx` debe leerlo con `window.location.hash`, no
  `useSearchParams`/`URLSearchParams(location.search)`.
- **Skills/Agentes**: `ui-ux-pro-max` antes de maquetar ambas pantallas · `ecc:react-reviewer`
  después.
- **Validar**: flujo manual completo login → "olvidé mi contraseña" → email → link → nueva
  contraseña → login con la nueva funciona, con la vieja da 401.

### P1.6 — Tests de la superficie nueva de auth

- **Estado**: ✅ Completada (2026-09-25). Confirmada explícitamente por el usuario.
- **Archivos**: `apps/api/vitest.config.ts` (CREATE), `apps/api/wrangler.test.toml` (CREATE —
  ver desvío abajo), `apps/api/test/apply-migrations.ts` (CREATE), `apps/api/src/lib/password.test.ts`,
  `reset-token.test.ts`, `routes/auth.test.ts`, `routes/users.test.ts`, `routes/users-last-owner.test.ts`
  (CREATE — el último no estaba en el plan original, ver desvío), `apps/api/tsconfig.json` (UPDATE:
  excluye `*.test.ts` del typecheck de producción), `apps/api/package.json` (UPDATE: script `test`).
- **Desvío del plan original — paquete de testing**: el plan asumía (conocimiento pre-entrenado)
  `@cloudflare/vitest-pool-workers`; verificado contra la documentación actual de Cloudflare, el
  paquete vigente es **`@cloudflare/vitest-plugin`** (`cloudflareTest` + `readD1Migrations`/
  `applyD1Migrations`, `vitest@^4`), una API distinta. Se usó el ejemplo oficial de Cloudflare
  (`workers-sdk/fixtures/vitest-plugin-examples/d1`) como referencia exacta.
- **Desvío — `wrangler.test.toml` dedicado** (no estaba en el plan): el `wrangler.toml` real tiene
  `MEDIA` (R2) y `EMAIL` (send_email) con `remote = true` — incluso en dev local dependen de
  servicios reales de Cloudflare (`EMAIL` ni siquiera está habilitado, ver P1.3). Un config de test
  dedicado, mínimo (solo `DB`, `JWT_SECRET`, `CUSTOMER_JWT_SECRET`), deja los tests 100%
  locales/offline — ambos bindings son opcionales en `Bindings` (env.ts) y el código ya los trata
  como tales, así que omitirlos no cambia el comportamiento bajo test.
- **🔴 Bug de seguridad real encontrado al escribir el test de "token vencido"**: `routes/auth.ts`
  guardaba `password_reset_tokens.expires_at` con `new Date(...).toISOString()`
  ("2026-09-25T18:15:23.456Z"), pero el canje compara `expires_at > datetime('now')` con el formato
  nativo de SQLite ("2026-09-25 18:15:23"). Al ser comparación de texto (columna TEXT), 'T' (0x54)
  es ASCII mayor que el espacio (0x20) — CUALQUIER token emitido compaaraba como "no vencido" el
  resto del día calendario, sin importar la hora real (el TTL nominal de 30 minutos no se cumplía
  dentro del mismo día). Corregido generando el vencimiento con el propio `datetime('now', ?)` de
  SQLite (modificador `'+30 minutes'` bindeado como parámetro, no interpolado — se mantiene 100%
  parametrizado). Como el envío de email real sigue bloqueado por P1.3, este bug nunca fue
  explotado en producción (nadie completó el flujo con un token real todavía).
- **Hallazgo documentado, no corregido**: el guard de "no eliminar al último owner" en el `DELETE`
  de `routes/users.ts` es en la práctica inalcanzable por HTTP — la ruta exige `requireRole('owner')`
  y bloquea la auto-eliminación (403) ANTES de llegar al conteo de owners en el `WHERE`; con un solo
  owner en la tabla, ese owner es necesariamente quien llama al endpoint, así que el guard de
  auto-eliminación se dispara siempre primero. Se documenta en `users-last-owner.test.ts` en vez de
  tocar el código: es defensa en profundidad intencional (mismo criterio que el JWT separado de
  clientes), no un bug — solo una rama de ese `WHERE` que hoy no es alcanzable por ningún camino de
  la API real.
- **Skills/Agentes**: se implementó directamente en vez de delegar a `ecc:tdd-guide` (agente) —
  esto es testeo retroactivo de código ya en producción y validado en vivo en fases previas, no
  desarrollo nuevo con TDD estricto RED-GREEN-REFACTOR; el agente hubiera partido sin el contexto ya
  cargado en la sesión sobre el código real. `ecc:security-reviewer` corrió sobre el fix y los tests
  nuevos antes de cerrar la fase y encontró 3 hallazgos reales más, todos corregidos: `wrangler.test.toml`
  reusaba el `database_id` real de dev/producción (footgun: Cloudflare resuelve D1 remoto por id, no
  por nombre — un `--remote` corrido por error contra ese config hubiera golpeado la base real; ahora
  usa un UUID placeholder) y 2 tests (`reset-valid`, `reset-reuse` en `auth.test.ts`) seguían insertando
  el `expires_at` con `new Date().toISOString()` en vez del `datetime('now', ?)` real — por el propio
  bug ya corregido, esos 2 tests habrían pasado igual SIN el fix, así que no eran una guarda de
  regresión efectiva (corregidos para usar el mismo formato que el INSERT real). El reviewer también
  señaló que filas de `password_reset_tokens` ya emitidas ANTES de este fix (con el formato ISO viejo)
  seguirían sin vencer de verdad — se confirmó que la DB local de dev no tiene ninguna fila así
  (la tabla está vacía: el envío real de email nunca se desplegó por P1.3, así que no hay tokens reales
  en juego); queda anotado acá como paso operativo para quien despliegue este fix a un ambiente con
  filas preexistentes: correr `DELETE FROM password_reset_tokens WHERE used_at IS NULL AND
  expires_at LIKE '%T%'` una sola vez antes de dar el deploy por cerrado.
- **Validar**: `pnpm --filter @sabor/api test` → 31/31 tests pasan (5 archivos). `pnpm typecheck`
  y `pnpm lint` en todo el monorepo, limpios.

---

## Parte 2 — Cuentas de cliente, carrito, puntos y sorteo mensual

### Contexto

Hoy la web (`apps/web`, Next.js export estático) solo tiene botones "Pedir por WhatsApp" por
ítem (`components/menu/OrderButton.tsx` + `lib/whatsapp.ts:buildItemOrderLink`, ambos
verificados) que abren un `wa.me` con mensaje armado en el cliente. No existe entidad de
pedido real — solo un click analítico (`events.order_click`). Sin pedido real no hay nada
objetivo a lo que atar puntos.

Se agrega: (1) carrito multi-ítem, (2) cuenta de cliente opcional que acumula puntos reales
por compras confirmadas por el dueño, canjeables por premios que el dueño define desde el
CMS, (3) entrada automática al sorteo mensual por cada compra confirmada, (4) card de pedido
en un panel admin nuevo. El pago sigue coordinándose por WhatsApp — no se integra pasarela.

**Decisión de producto ya acordada**: tener cuenta NO es obligatorio. Sin sesión, el carrito
arma un solo mensaje de WhatsApp con todos los ítems y no toca la base de datos (igual que
hoy, solo que agrupado). Con sesión, además se crea el pedido en D1 (`pending`) antes de abrir
WhatsApp. La confirmación del dueño en el CMS es la única fuente de verdad de que la venta
ocurrió — así se evita fraude/errores de puntos por pedidos que nunca se pagaron.

### Modelo de datos — `apps/api/migrations/0004_loyalty.sql`

> Renumerada de `0003` a `0004` respecto del borrador original — `0003` ya la ocupa
> `password_reset_tokens` (Parte 1, P1.2). Ver "Decisiones de integración".

> **El SQL de abajo es el borrador original.** La migración real (ya aplicada) difiere
> tras la revisión de `ecc:database-reviewer` — ver el archivo `0004_loyalty.sql` para la
> versión definitiva. Cambios: `customers.points_balance` con `CHECK (>= 0)`;
> `orders.points_awarded` con `CHECK (IS NULL OR >= 0)`; `loyalty_config` con `CHECK`
> en ambos campos numéricos; índices agregados en `order_items.item_id`,
> `raffle_entries.customer_id`, `reward_redemptions.reward_id`/`status`; `period` en
> `raffle_entries`/`raffle_draws` con `CHECK (... GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]')`;
> y un índice único parcial `idx_ledger_order_once ON points_ledger(order_id) WHERE
> reason = 'order_confirmed'` — mismo motivo que `UNIQUE(order_id)` en `raffle_entries`,
> a prueba de que el handler de confirmación (P2.3) corra dos veces sobre el mismo pedido.

Convenciones de `0001_init.sql`/`0002_collections.sql`: PK autoincrement, snake_case, FKs
explícitas, índices `idx_<tabla>_<col>`, `IF NOT EXISTS` (idempotente). El `ON DELETE` de los
FKs hacia `users(id)` no estaba especificado en el borrador original; se fija acá con el
mismo criterio que ya usa el esquema existente (`RESTRICT` para registros de negocio
importantes, `SET NULL` para atribución histórica que no debe bloquear el borrado de un
admin):

```sql
-- Clientes finales. Tabla separada de `users` (staff) a propósito — nunca compartir
-- esa tabla ni su CHECK de role. Ver sección "Seguridad: JWT de cliente separado".
CREATE TABLE IF NOT EXISTS customers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL UNIQUE,
  phone          TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  name           TEXT NOT NULL,
  points_balance INTEGER NOT NULL DEFAULT 0,
  token_version  INTEGER NOT NULL DEFAULT 0,
  last_login_at  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- code: identificador corto (ej. "A1B2C3") para referenciar el pedido en WhatsApp y en
-- la card del CMS. subtotal: SIEMPRE recalculado server-side, nunca el que manda el cliente.
CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  code           TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled')) DEFAULT 'pending',
  subtotal       REAL NOT NULL CHECK (subtotal >= 0),
  points_awarded INTEGER,
  confirmed_at   TEXT,
  confirmed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Snapshot de nombre/precio: el menú puede cambiar después de hecho el pedido.
CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  name_es    TEXT NOT NULL,
  name_en    TEXT NOT NULL DEFAULT '',
  size_label TEXT,
  unit_price REAL NOT NULL CHECK (unit_price > 0),
  quantity   INTEGER NOT NULL CHECK (quantity > 0)
);

-- Historial auditable. `customers.points_balance` es el contador rápido desnormalizado
-- (mismo patrón que `token_version`), actualizado atómicamente junto con cada fila acá.
CREATE TABLE IF NOT EXISTS points_ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  delta       INTEGER NOT NULL,
  reason      TEXT NOT NULL CHECK (reason IN ('order_confirmed', 'reward_redeemed', 'manual_adjustment')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Catálogo de premios que el dueño arma desde el CMS.
CREATE TABLE IF NOT EXISTS rewards (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name_es        TEXT NOT NULL,
  name_en        TEXT NOT NULL DEFAULT '',
  description_es TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  points_cost    INTEGER NOT NULL CHECK (points_cost > 0),
  image_r2_key   TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1,
  display_order  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reward_id    INTEGER NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
  points_spent INTEGER NOT NULL CHECK (points_spent > 0),
  status       TEXT NOT NULL CHECK (status IN ('pending', 'fulfilled', 'cancelled')) DEFAULT 'pending',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  fulfilled_at TEXT,
  fulfilled_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- UNIQUE(order_id): una sola entrada por pedido confirmado, a prueba de reintentos del handler.
CREATE TABLE IF NOT EXISTS raffle_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id    INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  period      TEXT NOT NULL,   -- '2026-09'
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- UNIQUE(period): imposible sortear dos veces el mismo mes.
CREATE TABLE IF NOT EXISTS raffle_draws (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  period             TEXT NOT NULL UNIQUE,
  winner_customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  winner_entry_id    INTEGER NOT NULL REFERENCES raffle_entries(id) ON DELETE RESTRICT,
  drawn_at           TEXT NOT NULL DEFAULT (datetime('now')),
  drawn_by           INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

-- Fila única (mismo patrón singleton que whatsapp_config).
CREATE TABLE IF NOT EXISTS loyalty_config (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  points_per_currency_unit    REAL NOT NULL DEFAULT 1,
  min_order_amount_for_points REAL NOT NULL DEFAULT 0,
  updated_at                  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_customer      ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orderitems_order     ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_ledger_customer      ON points_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_raffle_period        ON raffle_entries(period);
CREATE INDEX IF NOT EXISTS idx_redemptions_customer ON reward_redemptions(customer_id);
```

(El índice de `reward_redemptions` no estaba en el borrador original; se agrega por
consistencia con el resto del esquema, que indexa toda FK usada para filtrar.)

### Seguridad: JWT de cliente separado del de staff

`apps/api/src/lib/jwt.ts` y `middleware/auth.ts` ya firman/verifican tokens de `users` con
`JWT_SECRET`. Para `customers` se usa un **secret distinto** (`CUSTOMER_JWT_SECRET`) y un
payload de forma distinta (`{customerId, email}`, sin `role`). Es intencional: aunque el
middleware esté bien escrito, tener secrets separados hace estructuralmente imposible que un
token de cliente autentique contra rutas de staff (o viceversa) incluso ante un bug futuro de
guard — defensa en profundidad, no solo "confiar en que el `if` de rol esté bien puesto".
`middleware/customer-auth.ts` nuevo, con `requireCustomerAuth` (mismo patrón que
`requireAuth`: relee `customers` por id, valida `token_version`, `c.set('customer', ...)`).

### P2.1 — Migración + tipos/schemas compartidos

- **Estado**: ✅ Completada (2026-09-24)
- **Archivos**: `apps/api/migrations/0004_loyalty.sql` (CREATE, SQL arriba),
  `apps/api/src/db/rows.ts` (UPDATE — un `XRow`/`mapX` por tabla nueva, regla ya escrita en
  el header de ese archivo), `packages/shared/src/types.ts` (UPDATE: `Customer`, `Order`,
  `OrderItem`, `Reward`, `RewardRedemption`, `RaffleEntry`, `RaffleDraw`, `LoyaltyConfig`),
  `packages/shared/src/validation.ts` (UPDATE: `customerRegisterSchema`,
  `customerLoginSchema`, `createOrderSchema`, `rewardSchema`, `loyaltyConfigUpdateSchema`,
  `orderStatusUpdateSchema` — mismo estilo Zod que `whatsappUpdateSchema`/`createUserSchema`),
  `packages/shared/src/dto.ts` (UPDATE: `OrderDto`, `PointsBalanceDto`, etc.).
- **Espejar**: `db/rows.ts:1-4` (comentario de la regla), `validation.ts` estilo Zod existente.
- **Skills/Agentes**: `ecc:database-migrations` antes de la migración · `ecc:database-reviewer`
  (agente) para revisar el esquema completo (8 tablas nuevas, vale una pasada dedicada) ·
  `ecc:typescript-reviewer` para los tipos/schemas.
- **Validar**: `wrangler d1 migrations apply sabor-llanero --local`; `pnpm typecheck`.

### P2.2 — API: autenticación de clientes

- **Estado**: ✅ Completada (2026-09-24)
- **Archivos**: `apps/api/src/routes/customer-auth.ts` (CREATE: `POST /register`, `POST
  /login` rate-limited, `GET /me`, `PATCH /me`, `POST /change-password` — calco de
  `routes/auth.ts` contra `customers`/`CUSTOMER_JWT_SECRET`, reusa `lib/password.ts` tal
  cual), `apps/api/src/middleware/customer-auth.ts` (CREATE), `apps/api/src/env.ts` (UPDATE:
  `CUSTOMER_JWT_SECRET`, `CUSTOMER_AUTH_LIMITER` en `Bindings`, `Variables.customer?:
  AuthCustomer`), `apps/api/wrangler.toml` (UPDATE: secret + rate limiter namespace `2003`,
  en dev **y** `[env.production]`), `apps/api/.dev.vars.example` (UPDATE), `apps/api/src/index.ts`
  (UPDATE: montar rutas + guard de config de producción).
- **Skills/Agentes**: `ecc:security-review` (mismo checklist que P1.4: hashing, rate limit,
  anti-enumeración) · `workers-best-practices` (secret nuevo vía `wrangler secret put`) ·
  `ecc:security-reviewer` (agente) antes de cerrar — es superficie de auth nueva completa.
- **Validar**: probar registro/login/me/change-password con curl; confirmar que un token de
  `customers` NO es aceptado por `requireAuth` (rutas de staff) y viceversa.

### P2.3 — API: pedidos y confirmación atómica

- **Estado**: ✅ Completada (2026-09-24)
- **Desvío del plan original**: el plan asumía que el `.batch()` de esta fase era "primer uso en
  el repo" — es falso, ya se usaba en `routes/menu-items.ts` (DELETE+INSERT de overrides de
  precio) desde antes; se corrige acá para que el documento no induzca a pensar que no había
  precedente que espejar.
- **Archivos**: `apps/api/src/routes/orders.ts` (CREATE).
- **Acción**:
  - `POST /` (`requireCustomerAuth`): recibe `[{itemId, sizeId?, quantity}]`, recalcula
    precios server-side con `packages/shared/src/pricing.ts` (`resolveItemPrices`/
    `resolveSimplePrice`, ya existentes y puras — verificado, no se reimplementa nada), crea
    `orders`+`order_items` con snapshots, devuelve el pedido con su `code`.
  - `GET /` (`requireAuth`+`requireRole('owner','admin')`): lista para CMS, filtro `status`,
    paginado — mismo shape que `routes/menu-items.ts` list.
  - `PATCH /:id` (admin): confirmar/cancelar. Transición atómica e idempotente con el mismo
    idiom que el guard de "último owner" de `routes/users.ts` (`UPDATE orders SET status =
    'confirmed' WHERE id = ? AND status = 'pending' RETURNING *`), seguido de
    `c.env.DB.batch([...])` (transacción real de D1) que: suma puntos a
    `customers.points_balance`, inserta en `points_ledger`, inserta en `raffle_entries`
    (protegido por `UNIQUE(order_id)`), setea `orders.points_awarded`.
  - `GET /me` (customer): historial de pedidos propios.
- **Skills/Agentes**: `ecc:security-review` (nunca confiar en el precio del cliente) ·
  `ecc:database-reviewer` (agente, para revisar la transacción `.batch()` — primera vez que
  se usa en este repo, vale una revisión dedicada) · `workers-best-practices`.
- **Validar**: crear pedido con precios manipulados en el body → el `subtotal` guardado debe
  ser el recalculado server-side, no el enviado; confirmar dos veces el mismo pedido en
  paralelo (curl con `&`) → solo debe acreditarse una vez.

### P2.4 — API: premios, sorteo y configuración de puntos

- **Estado**: ✅ Completada (2026-09-24)
- **Archivos**: `apps/api/src/routes/rewards.ts` (CREATE: CRUD admin igual a
  `routes/menu-items.ts`; `GET /` público; `POST /:id/redeem` con
  `requireCustomerAuth` y guard atómico `UPDATE customers SET points_balance =
  points_balance - ? WHERE id = ? AND points_balance >= ? RETURNING *` para no dejar saldo
  negativo bajo concurrencia), `apps/api/src/routes/raffle.ts` (CREATE: `GET /entries?period=`
  admin, `POST /draw` solo `owner` con `SELECT ... ORDER BY RANDOM() LIMIT 1` — RNG no
  criptográfico, aceptable acá porque es un sorteo promocional, no un secreto de seguridad;
  `UNIQUE(period)` evita sortear dos veces el mismo mes), `apps/api/src/routes/loyalty-config.ts`
  (CREATE: `GET`/`PATCH` singleton, calco de `routes/whatsapp.ts`).
- **Skills/Agentes**: `ecc:api-design` (consistencia REST con el resto de rutas) ·
  `ecc:security-review` (concurrencia del canje) · `ecc:security-reviewer` (agente) porque
  toca saldo/puntos de clientes.
- **Validar**: canjear en paralelo con saldo justo para uno solo → solo uno debe tener éxito;
  sortear dos veces el mismo período → el segundo debe fallar por `UNIQUE(period)`.

### P2.5 — CMS: página "Pedidos"

- **Estado**: ⬜ Pendiente (prioridad alta dentro de la Parte 2 — es lo primero que el dueño
  necesita ver)
- **Archivos**: `apps/cms/src/pages/PedidosPage.tsx` (CREATE), `apps/cms/src/App.tsx`
  (UPDATE, ruta), `apps/cms/src/components/layout/Sidebar.tsx` (UPDATE, `LINKS` en
  `Sidebar.tsx:25-33`), `apps/cms/src/hooks/useCmsData.ts` (UPDATE, hook `useOrders`).
- **Espejar**: patrón `useAsync`/`useMutation` + `api.ts` con Bearer token de
  `store/sessionStore.ts` (idéntico a `pages/MenuItemsPage.tsx`); tabs por estado, cards con
  botones "Confirmar"/"Cancelar" vía `useMutation` (mismo patrón que el delete de
  `MenuItemsPage.tsx`).
- **Skills/Agentes**: `ui-ux-pro-max` antes de maquetar la página (primera vista que ve el
  dueño todos los días — vale cuidar la jerarquía visual) · `ecc:react-reviewer` después ·
  `ecc:a11y-architect` (agente) o skill `ecc:accessibility` dado que el proyecto ya usa
  `eslint-plugin-jsx-a11y`.
- **Validar**: crear pedido vía API → aparece en la lista → confirmar → desaparece de
  "pendientes"/aparece en "confirmados".
- **Estado**: ✅ Completada (2026-09-25). Validado en vivo en el navegador dos veces (Chrome
  DevTools MCP contra `wrangler dev` + `vite dev` locales): (1) antes del refactor de
  `OrderCard` — crear pedido vía curl → aparece en "Pendientes" → Confirmar → pasa a
  "Confirmados" con puntos; (2) después del refactor (dos pedidos, uno Confirmar y otro
  Cancelar) — ambas acciones funcionan de forma independiente por card, el foco vuelve al
  `<h1>` tras la acción (confirmado en el snapshot de accesibilidad: `focused level="1"`), el
  toast aparece, y ambas pestañas (Confirmados/Cancelados) muestran el pedido correcto con el
  badge correcto.

### P2.6 — CMS: Premios, Sorteo y configuración de puntos

- **Estado**: ⬜ Pendiente
- **Archivos**: `apps/cms/src/pages/PremiosPage.tsx` (CREATE, CRUD reusando el patrón de
  formulario/imagen de `MenuItemFormPage.tsx` + `routes/media.ts`), `SorteoPage.tsx` (CREATE:
  entradas del mes + botón "Sortear ganador" + historial), `LoyaltyConfigPage.tsx` (CREATE,
  calco de `WhatsappConfigPage.tsx`), `App.tsx` + `Sidebar.tsx` (UPDATE, 3 rutas más).
- **Skills/Agentes**: `ui-ux-pro-max` antes de cada página nueva · `ecc:react-reviewer`
  después · `ecc:accessibility`.
- **Validar**: crear premio con imagen → canjeable desde la web (P2.8); sortear → aparece en
  historial con el ganador correcto.
- **Estado**: ✅ Completada (2026-09-25). Validado en vivo en el navegador: crear/editar premio
  (dialog con foco automático, valores pre-cargados al editar), sortear con una entrada real
  (generada confirmando un pedido de verdad) → aparece en el historial con el cliente y fecha
  correctos, botón se auto-deshabilita tras sortear ese período; config de puntos carga y
  renderiza los valores actuales. "Canjeable desde la web" no se pudo validar (P2.8 no existe
  todavía) — ya se probó el canje a nivel API en P2.4.
- **Desvío del proceso**: a diferencia de las fases anteriores, NO se corrió `ui-ux-pro-max`
  antes de estas 3 páginas (se documenta a propósito, no es un olvido): son espejos casi 1:1 de
  páginas ya diseñadas (`WhatsappConfigPage.tsx`, `UsersPage.tsx`, `MediaManager.tsx`/
  `CategoryBannerControl.tsx`), no diseño nuevo. El review consolidado señaló que esto sí causó
  un desvío real (skeleton genérico en vez de `TableSkeleton`), ya corregido.
- **Gap del plan corregido**: P2.4 nunca agregó un endpoint para listar sorteos pasados, pero
  esta fase requiere "historial". Se agregó `GET /raffle/draws` (paginado, mismo patrón que
  `GET /orders`) a `routes/raffle.ts`.

### P2.7 — Web: carrito (sin cuenta)

- **Estado**: ✅ Completada (2026-09-25)
- **Archivos**: `apps/web/lib/cart.tsx` (CREATE: dos Context —`CartActionsContext` de
  referencia estable y `CartStateContext` que cambia con `lines`— más `localStorage`, mismo
  patrón de hidratación segura que `lib/lang.tsx`; expone `useCart()` combinado y
  `useCartActions()` solo-acciones, y los helpers `buildCartLineKey`/`cartLineFromItem`),
  `apps/web/components/menu/AddToCartButton.tsx` (CREATE), `apps/web/components/cart/CartButton.tsx`
  (CREATE), `apps/web/components/cart/CartLineRow.tsx` (CREATE), `apps/web/components/cart/CartPageContent.tsx`
  (CREATE), `apps/web/app/carrito/page.tsx` (CREATE), `apps/web/app/layout.tsx` (UPDATE:
  `<CartProvider>` envolviendo `{children}`, para que el badge del Navbar y `/carrito`
  compartan estado entre navegaciones client-side sin releer `localStorage`),
  `apps/web/components/sections/Navbar.tsx` (UPDATE: `CartButton` junto al botón de
  hamburguesa, visible en todos los breakpoints), `apps/web/components/menu/ItemCard.tsx`
  (UPDATE, bloque de `OrderButton` — el control "Agregar al carrito" va al lado),
  `apps/web/components/menu/ItemModal.tsx` (UPDATE, mismo control — ver desvío abajo),
  `apps/web/components/menu/OrderButton.tsx` (UPDATE menor: prop `hintId` opcional para
  compartir el hint de "Elige un tamaño" con `AddToCartButton`), `apps/web/lib/catalogUi.ts`
  (UPDATE: strings bilingües `addToCart`/`addedToCart`), `apps/web/components/ui/icons.tsx`
  (UPDATE: `CartIcon`, `CheckIcon`, `MinusIcon`, `PlusIcon`, `TrashIcon`), `apps/web/lib/whatsapp.ts`
  (UPDATE: `buildCartOrderLink`, mensaje multi-ítem SIEMPRE en español —no reusa la plantilla
  editable del dueño, pensada para un solo ítem—, además de `buildItemOrderLink` existente que
  se conserva intacto para el pedido directo de un ítem suelto).
- **Desvío del plan original**: el archivo original no listaba `ItemModal.tsx`, pero
  `ItemCard.tsx` oculta el bloque de precio/tamaño/CTA en mobile para las cards NO compactas
  (`hidden sm:flex`) — en el grid por categorías, el modal es la ÚNICA vía de compra en
  celular ("Elegir tamaño y pedir viven en el modal", comentario ya existente en el propio
  componente). Sin extender el modal, el carrito hubiera sido inutilizable en mobile para la
  mayoría del catálogo. Se agregó ahí también, con el mismo helper `cartLineFromItem`.
- **Nota**: esta fase NO depende de cuentas de cliente — funciona para invitados de punta a
  punta y no cambia el comportamiento actual salvo agrupar "N ítems → 1 WhatsApp"; confirmar
  vacía el carrito local (ningún registro nuevo en D1 — el pedido real con cuenta es P2.8).
- **Skills/Agentes**: `ui-ux-pro-max` antes de maquetar (carrito es UI de cara al cliente, la
  de mayor visibilidad de todo el plan) · `ecc:react-reviewer`, `ecc:a11y-architect` y
  `ecc:code-reviewer` (3 agentes en paralelo, mismo criterio que P2.5) después de escribir.
  Corregidos: 1 bug real de lógica (`addLine` pisaba nombre/tamaño con datos viejos al
  fusionar cantidades si el usuario agregaba el mismo ítem tras cambiar el toggle ES/EN — ahora
  refresca con el `input` más reciente), 1 HIGH de robustez (el botón "Confirmar pedido"
  dependía implícitamente del orden entre el commit de `clear()` y la navegación nativa del
  `<a href>` — ahora usa `preventDefault` + `window.open` con el href ya capturado en el
  closure del render), 2 HIGH/MEDIUM de accesibilidad (el botón "Agregar al carrito"
  deshabilitado no explicaba el motivo, a diferencia de `OrderButton` al lado — ahora comparten
  el mismo hint vía `aria-describedby`; el aria-label del botón "−" del stepper decía "quitar
  una unidad" pero en cantidad 1 borra toda la línea — ahora el label cambia para reflejarlo),
  1 MEDIUM de accesibilidad (agregar el mismo ítem dos veces seguidas dentro de la ventana de
  feedback no volvía a anunciarse al lector de pantalla porque el texto del `aria-live` no
  mutaba — ahora fuerza un ciclo false→true), 1 MEDIUM de rendimiento (un solo contexto
  mezclaba `lines` de alta frecuencia con acciones estables, re-renderizando los 30+ `ItemCard`
  de `/menu` en cada operación del carrito — separado en `CartActionsContext`/`CartStateContext`),
  1 LOW de contraste (ícono de "quitar línea" en reposo no llegaba a 3:1), 1 LOW de foco visible
  (el `<h1>` enfocado programáticamente usaba `outline-none` sin estilo `focus-visible` propio),
  y la duplicación de la lógica de armado de línea entre `ItemCard`/`ItemModal` (extraída a
  `cartLineFromItem` en `lib/cart.tsx`). Se aceptó sin resolver (no bloqueante, documentado por
  el propio a11y-architect): el foco siempre vuelve al `<h1>` al quitar una línea aunque queden
  otras — simple y ya evita el bug de foco perdido a `<body>` de P1.5/P2.5, perfeccionarlo
  (foco más local) queda como mejora futura.
- **Validado en vivo en el navegador** (Chrome DevTools MCP, `wrangler dev` + `next dev`
  locales): agregar ítem sin tamaño y con tamaño, desde la card y desde el modal en viewport
  mobile (390px); badge del Navbar actualiza en vivo; stepper de cantidad; quitar línea con el
  foco cayendo en el `<h1>` (no en `<body>`); agregar el mismo ítem+tamaño en ES y después en
  EN confirma que el `sizeLabel` de la línea se actualiza ("Grande"→"Large") sin duplicar fila;
  confirmar abre el wa.me correcto (verificado con 2 ítems, mensaje y total exactos) y vacía el
  carrito; estado vacío.

### P2.8 — Web: cuenta de cliente + checkout logueado

- **Estado**: ✅ Completada (2026-09-25), incluida la revisión dedicada de `ecc:a11y-architect`
  (reintentada tras fallar una vez por rate-limit de la cuenta — ver hallazgos y fixes abajo).
- **Archivos**: `apps/web/lib/customerAuth.tsx` (CREATE, Context, mismo patrón que
  `lib/lang.tsx`/`lib/cart.tsx` — sin Zustand, `apps/web` no lo tiene y no lo necesita; expone
  `customer`/`loading`/`login`/`register`/`logout`/`refresh`), `apps/web/lib/accountData.ts`
  (CREATE: `fetchRewards`/`fetchMyOrders`), `apps/web/lib/api.ts` (UPDATE: token de cliente en
  `localStorage` con `getCustomerToken`/`setCustomerToken`/`clearCustomerToken`, header
  `Authorization` automático, limpieza en 401, método `patch` nuevo), `apps/web/lib/cart.tsx`
  (UPDATE: campo `sizeId` agregado a `CartLine`, necesario para armar `POST /orders`),
  `apps/web/lib/whatsapp.ts` (UPDATE: `orderCode` opcional en `buildCartOrderLink`),
  `apps/web/components/cart/CartPageContent.tsx` (UPDATE: checkout logueado — crea el pedido
  real antes de abrir WhatsApp), `apps/web/components/account/*` (CREATE: `AccountFormField`,
  `LoginForm`, `RegisterForm`, `AccountProfileSection`, `AccountPageContent`, `RewardCard`,
  `OrderHistoryList`, `AccountNavLink`), `apps/web/app/cuenta/login/page.tsx`,
  `.../registro/page.tsx`, `.../page.tsx` (perfil: saldo de puntos + edición inline, historial
  de pedidos, catálogo de premios + canje) (CREATE), `apps/web/app/layout.tsx`
  (`<CustomerAuthProvider>`), `apps/web/components/sections/Navbar.tsx` (`AccountNavLink`, ver
  desvío abajo), `apps/web/components/ui/icons.tsx` (`UserIcon`/`GiftIcon`/`LogOutIcon`).
- **Desvío del plan original**: se agregó `AccountNavLink` al Navbar (no estaba en el plan) —
  sin un punto de entrada visible a `/cuenta` fuera del flujo del carrito, la cuenta no era
  descubrible. Mismo criterio que la extensión a `ItemModal` en P2.7.
- **Checkout logueado — detalle técnico**: `POST /orders` se dispara ANTES de abrir WhatsApp.
  Para no perder el pedido si el navegador bloquea el pop-up (la llamada a la API es async, así
  que abrir la pestaña recién después del `await` perdería el gesto de usuario), se abre una
  pestaña en blanco de forma síncrona dentro del propio click y se le asigna la URL final
  recién cuando el pedido ya existe — para eso hace falta la referencia a la pestaña, que
  `window.open(..., "noopener")` no permite devolver, así que se corta `tab.opener = null` a
  mano antes de navegarla (mismo efecto contra reverse-tabnabbing, confirmado por
  `ecc:security-reviewer`). Si la pestaña no se puede abrir/redirigir igual (el cliente la
  cerró a mano mientras esperaba), se muestra un link manual — nunca se pierde el pedido ya
  creado ni se dan mensajes de error falsos.
- **Skills/Agentes**: `ui-ux-pro-max` antes de las pantallas nuevas · `ecc:react-reviewer`,
  `ecc:security-reviewer` y `ecc:code-reviewer` en paralelo (regla fija de auth/dinero/datos de
  clientes) después de escribir. Corregidos: 1 bug real coincidente en las 3 revisiones (el
  `try/catch` de `confirmLoggedIn` envolvía tanto la creación del pedido como la navegación de
  la pestaña — si el pedido se creaba pero la navegación fallaba, se mostraba "no se pudo crear
  el pedido" sin vaciar el carrito, arriesgando un pedido real duplicado si el cliente
  reintentaba; separado en dos pasos, con fallback de link manual), 1 HIGH (un 401 de
  `/customers/login` por contraseña incorrecta borraba el token de una sesión YA válida si el
  cliente logueado visitaba `/cuenta/login/` por bookmark y erraba la contraseña — el 401 de
  esos dos endpoints ahora está excluido de la limpieza automática de token; validado en vivo:
  el token no cambia tras un intento de login fallido estando logueado), 1 MEDIUM (`loadMe`
  trataba cualquier error, no solo un 401 real, como sesión inválida — un refetch transitorio
  fallido tras guardar un cambio con éxito deslogueaba en silencio; ahora solo un `ApiError`
  con `status === 401` limpia `customer`), 1 MEDIUM (`loadMe`/`refresh` sin secuenciar — dos
  llamadas casi simultáneas podían resolver fuera de orden y pisar el estado con datos viejos;
  se agregó una guarda de "última solicitud vigente" con un contador, mismo criterio que
  `useAsync`), 1 MEDIUM (`AccountProfileSection` sincronizaba `name`/`phone` con el `customer`
  del contexto en un efecto sin condición — un `refresh()` disparado por OTRA acción de la
  página, ej. canjear un premio, pisaba una edición de perfil en curso sin guardar; ahora el
  efecto no corre mientras `editing` es `true`), 1 HIGH de UX (el saldo de puntos se
  sincronizaba vía `useEffect` + `useState(0)`, mostrando "0" un frame antes del valor real al
  entrar a la página — ahora se computa en el render con un override opcional solo para el
  feedback optimista post-canje, que se limpia solo cuando `refresh()` ya trajo un valor
  coincidente), y 2 LOW/MEDIUM (`order?.code`/`res?.pointsBalance` seguían el camino feliz si
  la API devolvía 2xx sin body — ahora se tratan como error explícito). Se aceptó sin resolver:
  el JWT de cliente en `localStorage` (superficie de XSS inherente a cualquier SPA sin cookies
  httpOnly) — no es una regresión de P2.8, replica el mismo patrón ya aceptado para el staff en
  `apps/cms/src/store/sessionStore.ts` desde P1.1, y migrar a cookies httpOnly excede el
  alcance de esta fase; el header `Authorization` viajando en requests públicas y la limpieza
  de token acotada solo a un puñado de rutas quedaron como LOW aceptados (bajo riesgo real,
  ningún endpoint público hoy devuelve 401).
- **Revisión de accesibilidad** (`ecc:a11y-architect`, reintentada tras fallar por rate-limit):
  encontró 4 HIGH, 2 MEDIUM y 2 LOW reales sobre `apps/web/components/account/*` y
  `CartPageContent.tsx` (los formularios base — `AccountFormField`, `LoginForm`, `RegisterForm`
  — salieron sin hallazgos, ya seguían el patrón aprobado en P1.5). Corregidos: 2 HIGH de foco
  en `AccountProfileSection` (el toggle Editar/Cancelar/Guardar dejaba el foco en `<body>` al
  desmontarse el control que lo tenía — se agregaron refs al input "Nombre" y al botón "Editar",
  con un efecto que mueve el foco al abrir/cerrar edición; **al implementarlo se detectó un bug
  real**: el guard de "saltar el primer render" con un flag booleano no sobrevive a la doble
  invocación de efectos de React Strict Mode en desarrollo — la primera invocación apagaba el
  flag y la segunda, viendo el flag ya apagado, robaba el foco al botón "Editar" en CADA carga
  de la página; se corrigió comparando contra el `editing` del render anterior en vez de un
  flag de una sola vez, validado en vivo que el foco ya no se roba al cargar); 1 HIGH de tamaño
  de target (botón "Editar" sin `min-h-11`, a diferencia de sus vecinos "Guardar"/"Cancelar");
  1 HIGH en `CartPageContent` (el link manual de WhatsApp cuando el navegador bloquea la pestaña
  vivía dentro de la rama `lines.length > 0`, pero `clear()` ya había vaciado el carrito para
  cuando ese mensaje podía aparecer — **otro bug real** encontrado al aplicar el fix de foco: el
  mensaje nunca llegaba a renderizarse; se sacó del condicional y se le agregó foco automático
  al link); 2 MEDIUM de confirmación de éxito sin anunciar (guardar perfil y canjear premio no
  daban ninguna señal a lectores de pantalla — se agregaron mensajes `role="status"` transitorios
  en ambos, y `role="status"` a los 3 textos de "Cargando…"); 2 LOW (contraste insuficiente en
  `OrderHistoryList` — fecha y badge "Cancelado" en `ink/50`, subidos a `ink/70`; `aria-describedby`
  de `AccountFormField` podía apuntar a un id de hint que no se monta si `error` también está
  presente — condición corregida). Validado en vivo cada fix tras aplicarlo.
- **Validado en vivo en el navegador** (Chrome DevTools MCP + `wrangler dev` + `next dev` + CMS
  local): registro con auto-login, login, logout; visitar `/cuenta` sin sesión redirige a
  login; checkout logueado crea un pedido real (`POST /orders`) visible como pendiente en el
  CMS, confirmado desde ahí, con los puntos reflejados en `/cuenta` tras recargar; canje de
  premio de prueba descuenta el saldo y el botón se deshabilita solo cuando no alcanza; edición
  inline de nombre/teléfono guarda correctamente; un intento de login fallido estando ya
  logueado NO cierra la sesión (token verificado igual en `localStorage` antes y después).
- **Validar**: registrarse → loguearse → agregar al carrito → confirmar → pedido en estado
  `pending` visible en CMS (P2.5) → dueño confirma → puntos reflejados en `/cuenta`. ✅ (ver
  validación en vivo arriba)

---

## Decisiones de integración entre ambas partes

| Punto de conflicto | Resolución |
|---|---|
| Ambos borradores originales llamaban `0003` a su migración | `0003_password_reset_tokens.sql` (Parte 1) va primero; la de lealtad pasa a **`0004_loyalty.sql`** (Parte 2). |
| Namespace de rate limiter | `LOGIN_LIMITER`=2001 y `EVENTS_LIMITER`=2002 ya existen. Parte 1 **reusa** `LOGIN_LIMITER` para forgot/reset-password en vez de pedir un namespace nuevo — así el `2003` queda libre y sin colisión para `CUSTOMER_AUTH_LIMITER` (Parte 2). |
| `env.ts` / `wrangler.toml` / `index.ts` compartidos | Ambas partes agregan bindings/secrets a los mismos 3 archivos. Hacer Parte 1 completa antes de arrancar Parte 2 evita conflictos de merge; el guard de configuración de producción en `index.ts` termina revisando: `JWT_SECRET`, `WEB_ORIGIN`/`CMS_ORIGIN`, `LOGIN_LIMITER`, `EVENTS_LIMITER` (ya existentes) + `EMAIL` (P1.3) + `CUSTOMER_JWT_SECRET`/`CUSTOMER_AUTH_LIMITER` (P2.2). |
| Trampa ya documentada en `BLUEPRINT.md` | Los envs de wrangler NO heredan `vars`/bindings — todo binding nuevo (`EMAIL`, `CUSTOMER_JWT_SECRET`, `CUSTOMER_AUTH_LIMITER`) se declara en el bloque top-level **y** en `[env.production]`, o producción no lo ve. |
| `customers` vs `users` | Tablas y JWT secrets completamente separados por diseño (ver "Seguridad: JWT de cliente separado") — cero superficie compartida con el trabajo de la Parte 1. |
| `ON DELETE` de FKs hacia `users(id)` en el esquema de lealtad | No especificado en el borrador original; fijado en P2.1 como `SET NULL` para atribución histórica (`confirmed_by`, `fulfilled_by`) y `RESTRICT` para auditoría dura (`drawn_by`), siguiendo el criterio ya usado en `0001_init.sql`. |

## Recursos de Cloudflare — referencia rápida

| Recurso | Tipo | Namespace/config | Usado por | Fase |
|---|---|---|---|---|
| `JWT_SECRET` | secret | (ya existe) | Auth de staff (`users`) | — |
| `LOGIN_LIMITER` | rate limit binding | namespace `2001` | `/login`, `/change-password`, `/forgot-password`, `/reset-password` | P1.4 extiende |
| `EVENTS_LIMITER` | rate limit binding | namespace `2002` | `/events` | — |
| `EMAIL` | `send_email` binding | sin secret | `/forgot-password` | P1.3 |
| `CUSTOMER_JWT_SECRET` | secret | nuevo | Auth de clientes (`customers`) | P2.2 |
| `CUSTOMER_AUTH_LIMITER` | rate limit binding | namespace `2003` (nuevo) | `/customers/register`, `/customers/login` | P2.2 |

## Skills y agentes ECC — cuándo correr cada uno

| Categoría | Skill/Agente | Cuándo |
|---|---|---|
| Diseño de UI/UX | skill `ui-ux-pro-max` | Antes de escribir CUALQUIER página/componente nuevo en `apps/web` o `apps/cms` (P1.1, P1.5, P2.5, P2.6, P2.7, P2.8) |
| Revisión de React | agente `ecc:react-reviewer` | Después de escribir/tocar cualquier `.tsx` |
| Accesibilidad | skill `ecc:accessibility` / agente `ecc:a11y-architect` | Fases con UI nueva orientada al cliente final (carrito, cuenta) o con muchos estados (Pedidos, Sorteo) |
| Email transaccional | skill `cloudflare-email-service` | P1.3 — producto 2025, no confiar en conocimiento pre-entrenado |
| Cloudflare Workers | skill `workers-best-practices`, skill `wrangler` | Cualquier fase que toque `wrangler.toml`, `env.ts`, secrets o bindings (P1.3, P1.4, P2.2, P2.3) |
| Migraciones SQL | skill `ecc:database-migrations` | Antes de escribir cualquier `.sql` nuevo (P1.2, P2.1) |
| Revisión de esquema/queries | agente `ecc:database-reviewer` | P2.1 (8 tablas nuevas), P2.3 (primer uso de `.batch()` en el repo) |
| Seguridad general | skill `ecc:security-review` | Cualquier fase de auth, dinero/puntos o datos de usuario (P1.4, P2.2, P2.3, P2.4, P2.8) |
| Auditoría de seguridad final | agente `ecc:security-reviewer` | Al cerrar cada fase de auth/dinero antes de considerarla terminada (regla global ya fijada, reforzada acá) |
| Diseño REST | skill `ecc:api-design` | P2.4 (rutas nuevas: rewards/raffle/loyalty-config) |
| Revisión general de código | agente `ecc:code-reviewer` | Al terminar cualquier fase (regla global, no específica de este proyecto) |
| TDD | agente `ecc:tdd-guide` | Solo si se confirma P1.6, o si el usuario pide tests para la Parte 2 |

## Validación global

```bash
pnpm typecheck                                              # tsc --noEmit en todo el monorepo
pnpm lint                                                    # eslint flat config
cd apps/api && pnpm wrangler d1 migrations apply sabor-llanero --local
make dev                                                     # api :8787 + web :3000 + cms :5174
```

## Riesgos consolidados

| Riesgo | Parte | Probabilidad | Mitigación |
|---|---|---|---|
| Olvidar declarar un binding nuevo en `[env.production]` | 1 y 2 | Media (ya documentado como trampa recurrente en este repo) | Checklist de "Decisiones de integración" + guard de config en `index.ts` que falla con 500 explícito |
| `@cloudflare/workers-types` desactualizado no trae tipos de `SendEmail` | 1 | Alta | Bump del paquete primero; si no, declarar el tipo a mano (mismo patrón que `RateLimit`) |
| Reusar `LOGIN_LIMITER` mezcla conteo de login con el de recuperación | 1 | Baja (tráfico admin mínimo) | Aceptado como default; separar con namespace propio si molesta en el futuro |
| Primer uso de `c.env.DB.batch()` en el repo sin precedente a espejar | 2 | Media | Revisión dedicada con `ecc:database-reviewer` en P2.3 antes de dar la fase por cerrada |
| Fraude: cliente infla su carrito o edita precios en el request | 2 | Media si no se valida | `orders.subtotal` SIEMPRE recalculado server-side con `pricing.ts`; nunca se confía en el precio del body (validado explícitamente en P2.3) |
| Concurrencia en canje de premios deja saldo negativo | 2 | Baja | Guard atómico `UPDATE ... WHERE points_balance >= ?` (mismo idiom que el resto del repo) |
| Doble entrada al sorteo por reintento del handler de confirmación | 2 | Baja | `UNIQUE(order_id)` en `raffle_entries` |
| `CUSTOMER_AUTH_LIMITER` compartido entre register/login/change-password: un flood de registros desde una IP compartida (wifi de un edificio/evento) puede bloquear el login de otros clientes en esa IP por hasta 1 min | 2 | Baja (tráfico bajo, pizzería única) | Aceptado como default (mismo criterio que compartir `LOGIN_LIMITER` en Parte 1); separar en un namespace propio si molesta en el futuro |
| `/customers/register` no verifica el email (ni CAPTCHA): permite registrar la cuenta de otra persona (bloqueo de identidad) y altas automatizadas | 2 | Baja hoy (no hay nada de valor que ganar); **sube antes de que existan puntos/premios/sorteo reales** (P2.3-P2.4) | Pendiente de decidir verificación de email o CAPTCHA antes de que la Parte 2 llegue a producción — no bloquea P2.2 porque hoy no hay nada que un registro falso pueda explotar |
| Alcance grande (14 fases, 3 apps) puede perder continuidad entre sesiones de Claude | 1 y 2 | Media | Este mismo documento — actualizar estado/changelog es obligatorio por instrucción al inicio del archivo |

## Criterios de aceptación globales

- [ ] Parte 1 y Parte 2 completas según sus criterios por fase — Parte 2 cerrada (P2.1-P2.8,
      con las 4 revisiones de la fase completas). Parte 1: P1.1, P1.2, P1.4, P1.5 y P1.6
      cerradas; solo queda **P1.3** pendiente, bloqueada fuera del control de esta sesión
      (requiere que el dueño habilite/pague Email Sending en Cloudflare).
- [x] `pnpm typecheck` y `pnpm lint` pasan en todo el monorepo.
- [x] Ningún precio ni saldo de puntos se confía del cliente — todo recalculado/validado server-side.
- [x] Cero secretos nuevos innecesarios (email vía binding nativo, no SMTP con credenciales).
- [x] JWT de cliente y de staff son estructuralmente incompatibles entre sí.
- [x] Este documento refleja el estado real al final de cada sesión de trabajo.

## Registro de cambios

| Fecha | Fase(s) | Qué se hizo | Desvíos del plan original |
|---|---|---|---|
| 2026-09-24 | — | Creación de este documento (fusión del plan de seguridad de cuentas admin + el plan de cuentas de cliente/carrito/puntos/sorteo) | Renumeración de migración `0003`→`0004` para lealtad; namespace `2003` reasignado a `CUSTOMER_AUTH_LIMITER`; `ON DELETE` de FKs hacia `users` fijado explícitamente en el esquema de lealtad |
| 2026-09-24 | P1.1 | Modal "Editar usuario" en `UsersPage.tsx` (Nombre/Rol/Contraseña opcional) sobre el `PATCH /users/:id` ya existente. Revisado por `ecc:react-reviewer` y `ecc:code-reviewer`; 3 issues HIGH encontrados y corregidos: (1) autoedición vía el modal bumpea `token_version` y desloguea sin aviso — el botón "Editar" ahora se oculta para el propio usuario, igual que "Eliminar"; (2) ids de DOM duplicados con el form de "Nuevo admin" (`id="Nombre"`/`id="Rol"` por el fallback de `FormField`) — se separó el formulario en `EditUserForm` con ids explícitos (`edit-user-*`); (3) flash de datos del usuario anterior por sincronizar state vía `useEffect` — reemplazado por `key={user.id}` + `useState` lazy en `EditUserForm`. `pnpm typecheck` OK. | Se extrajo `EditUserForm` como subcomponente (no estaba en el plan original, pero necesario para resolver el ids-duplicados + flash de forma correcta) |
| 2026-09-24 | P1.2 | Migración `0003_password_reset_tokens.sql` (tabla + índice por `user_id`), aplicada en local (`wrangler d1 migrations apply --local`). Revisada por `ecc:code-reviewer`: aprobada sin issues (solo nota LOW no accionable — índice de `expires_at` es YAGNI hasta que exista un job de limpieza). | Ninguno |
| 2026-09-24 | P1.3 (parcial) | Binding `EMAIL` (`send_email`) agregado a `wrangler.toml` (dev + producción), tipo `SendEmail` en `env.ts`, guard de producción en `index.ts`. Fase queda **bloqueada**: falta que el usuario habilite el dominio real en Cloudflare Email Sending (`wrangler email sending enable`), acción que requiere su login/DNS y no es automatizable desde la sesión. | El skill `cloudflare-email-service` corrigió el supuesto original del plan: la API 2025 es `env.EMAIL.send({...})`, no un `EmailMessage`/MIME manual |
| 2026-09-24 | P1.3 (investigación) | Usuario intentó habilitar el dominio vía `wrangler email sending enable` (CLI) → `Unauthorized [code: 2036]` (bug conocido del token OAuth de `wrangler login` con este endpoint beta). Redirigido a Dashboard → confirmó que Email Sending a destinatarios arbitrarios requiere plan Workers Paid ($5/mes); Email Routing (gratis) es un producto distinto que NO habilita el binding de sending. Usuario decidió pausar P1.3 y seguir con otras fases. | Ninguno en código; deja la fase explícitamente en manos del usuario (pagar plan, verificar direcciones destino gratis, o seguir pausada) |
| 2026-09-24 | P1.4 | Endpoints `POST /auth/forgot-password` y `POST /auth/reset-password` en `routes/auth.ts` + `lib/reset-token.ts` (token de 32 bytes random, hash SHA-256 base64url) + schemas/DTOs en `packages/shared`. Revisado por `ecc:security-reviewer` y `ecc:code-reviewer`. Corregido 1 issue MEDIUM (timing side-channel: el `DB.batch()` de invalidación solo corría cuando el usuario existía, delatando por tiempo de respuesta si el email existe pese a que el mensaje de respuesta es idéntico — ahora las 2 DELETE corren siempre en ambas ramas, solo el INSERT queda condicional) y 2 LOW (token del link ahora va en fragment `#token=` en vez de query string; `resetPasswordSchema.token` con `.max(200)`). `pnpm typecheck` OK en `@sabor/api` y `@sabor/shared`. También se corrigió el header obsoleto de `dto.ts` que el propio plan marcaba como desviado ("aún no implementada — fase 3"). | Ninguno respecto del diseño de P1.4; nota agregada a P1.5 para que `ResetPasswordPage.tsx` lea el token de `window.location.hash`, no de query params |
| 2026-09-24 | P1.5 | `ForgotPasswordPage.tsx` y `ResetPasswordPage.tsx` (CREATE, fuera de `Protected` en `App.tsx`), link "¿Olvidaste tu contraseña?" en `LoginPage.tsx`. Revisado por `ecc:react-reviewer`, `ecc:a11y-architect` y `ecc:code-reviewer`. Corregidos: 1 HIGH (foco perdido en la transición form→confirmación: el form con el botón enfocado desaparece del DOM y el foco cae a `<body>`; se agregó `ref`+`tabIndex={-1}`+`useEffect` para mover el foco al mensaje resultante) y 2 MEDIUM (el `role="alert"` de "token inválido" en `ResetPasswordPage` está presente desde el primer render y algunos lectores de pantalla no lo anuncian si no es insertado por una mutación posterior — mismo fix de foco lo cubre; links standalone bajo el tamaño mínimo de 24px de SC 2.5.8 — se agregó `py-2`/`inline-block`). También se agregó `window.history.replaceState` para sacar el token del URL visible tras capturarlo, `aria-busy` en el `Button` compartido, y un hint de "Mínimo 8 caracteres" en el campo de contraseña nueva. `pnpm typecheck` OK. | Ninguno respecto del diseño; 3 issues LOW del a11y-architect (aria-describedby en `FormField`, trim de inputs) quedan sin resolver a propósito — no afectan a estas dos páginas y tocarían un componente compartido sin necesidad actual (YAGNI) |
| 2026-09-24 | P2.1 | Migración `0004_loyalty.sql` (9 tablas), tipos en `types.ts`, schemas en `validation.ts`, DTOs en `dto.ts`, Row/mapper en `db/rows.ts`. Revisado por `ecc:database-reviewer` (dedicado, 9 tablas nuevas) y `ecc:typescript-reviewer`. Corregidos 2 HIGH del schema (`customers.points_balance` sin piso — se agregó `CHECK (>= 0)`; `points_ledger` sin protección contra doble acreditación por reintento del handler de confirmación — se agregó índice único parcial `idx_ledger_order_once ... WHERE reason = 'order_confirmed'`, mismo idiom que `UNIQUE(order_id)` de `raffle_entries`) y varios MEDIUM/LOW (CHECK faltante en `orders.points_awarded` y en ambos campos de `loyalty_config`; índices faltantes en `order_items.item_id`, `raffle_entries.customer_id`, `reward_redemptions.reward_id`/`status`; formato de `period` sin validar — se agregó `CHECK (... GLOB 'YYYY-MM')`). Del lado de tipos: se agregó `updateRewardSchema` que faltaba (patrón `create*`/`update*.partial()` ya usado por categorías/ítems, `rewardSchema` se renombró a `createRewardSchema`). La migración ya estaba aplicada en local sin datos reales; se dropearon las 9 tablas vacías, se desregistró del tracking de wrangler y se reaplicó corregida + reseed. `pnpm typecheck` OK en `shared`/`api`/`cms`. | El bloque SQL original de este documento (arriba) quedó desactualizado respecto de la migración real — se agregó una nota señalando la diferencia en vez de reescribir todo el bloque |
| 2026-09-24 | P2.2 | `routes/customer-auth.ts` + `middleware/customer-auth.ts` (CREATE): register/login/me/patch-me/change-password contra `customers`, JWT con secret y forma de payload separados (`lib/jwt.ts`: `CustomerJwtPayload`/`signCustomerToken`/`verifyCustomerToken`). `env.ts`/`wrangler.toml`/`.dev.vars` con `CUSTOMER_JWT_SECRET` + `CUSTOMER_AUTH_LIMITER` (namespace 2003). Validado en vivo con `wrangler dev` + curl: registro/login/me/change-password OK, y un token de cliente contra `/auth/me` (staff) y uno de staff contra `/customers/me` dan 401 en ambas direcciones (aislamiento estructural confirmado, no solo de diseño). Revisado por `ecc:security-reviewer` y `ecc:code-reviewer`. Corregido 1 MEDIUM (lost-update en `PATCH /me`: el merge de `name`/`phone` opcionales se hacía con un SELECT previo + merge en app code, dos PATCH concurrentes podían pisarse el cambio — ahora `COALESCE` atómico dentro del propio UPDATE) y 1 MEDIUM (inputs sin cota en el endpoint público `/register` — se agregó `.max()` a email/name/phone). Se evaluó y revirtió un cambio sugerido (marcar `Variables.user`/`customer` opcionales en `env.ts` como guardrail de compilación): rompía 10 call-sites de código ya aprobado en fases previas para blindar contra un bug que hoy no puede pasar (toda ruta que lee `c.get('user')` ya pasó por `requireAuth`) — no se justificaba el costo. | 2 riesgos de diseño quedaron documentados como aceptados en "Riesgos consolidados" en vez de resueltos: `CUSTOMER_AUTH_LIMITER` compartido entre register/login puede bloquear login por flood de registro desde la misma IP; `/register` no verifica email ni tiene CAPTCHA (riesgo bajo hoy, sube antes de que P2.3/P2.4 den valor real a una cuenta falsa) |
| 2026-09-24 | P2.3 | `routes/orders.ts` (CREATE): `POST /` (recalcula precios server-side con `resolveItemPrices`/`resolveSimplePrice`, nunca confía en el body), `GET /` (staff, paginado, filtro status), `GET /me` (cliente), `PATCH /:id` (confirmar/cancelar atómico + acredita puntos y entrada al sorteo). Validado en vivo dos veces (antes y después del refactor de abajo): precio manipulado en el body se ignora (subtotal siempre el recalculado), y confirmar el mismo pedido dos veces en paralelo acredita puntos exactamente una vez (verificado en DB: `points_balance`, `points_ledger`, `raffle_entries`, todos consistentes con una sola acreditación). Revisado por `ecc:database-reviewer` (dedicado) y `ecc:code-reviewer`. Corregidos: 1 MEDIUM real de atomicidad (el INSERT de `orders` y el `.batch()` de `order_items` eran dos operaciones D1 separadas — si el batch fallaba a mitad de camino podía quedar un pedido "fantasma" sin ítems pero con subtotal, confirmable por el staff y capaz de acreditar puntos sobre nada; se resolvió moviendo todo a un solo `.batch()` usando `INSERT ... SELECT id FROM orders WHERE code = ?` en vez de encadenar el id del INSERT anterior), 1 MEDIUM de precisión flotante (`Math.floor(subtotal * pointsPerUnit)` podía restar 1 punto por el redondeo binario de floats — ahora redondea a 6 decimales antes de flooring), 1 MEDIUM de validación (`status` en `GET /` no se validaba contra el enum, un typo devolvía 200 con lista vacía en vez de 400 — ahora valida contra `ORDER_STATUSES`), y 2 LOW de índices faltantes (`orders.confirmed_by`, `points_ledger.order_id`, agregados a la migración y reaplicados en local). También se extrajeron `loadPricingContext`/`buildOrderLine` y `awardLoyaltyForOrder` para bajar 2 funciones que superaban las 50 líneas. | El plan asumía que este era el primer uso de `.batch()` en el repo — ya se corrigió esa afirmación en la sección de la fase; el patrón `INSERT...SELECT` dentro de un batch para evitar encadenar un id de RETURNING tampoco estaba anticipado en el plan original |
| 2026-09-24 | P2.4 | `routes/rewards.ts` + `routes/raffle.ts` + `routes/loyalty-config.ts` (CREATE): CRUD de premios (+ imagen R2, espejo de `categories.ts`), canje atómico, listado/sorteo de participantes (`UNIQUE(period)` como guard real, sin pre-chequeo), config de puntos (calco de `whatsapp.ts`). Validado en vivo: canjear en paralelo con saldo justo para uno solo → solo uno tiene éxito (verificado en DB: 1 redención, 1 fila de ledger); sortear el mismo período dos veces en paralelo → el segundo falla 409 por `UNIQUE(period)`. Revisado por `ecc:security-reviewer` y `ecc:code-reviewer`. Corregido 1 **HIGH** (el débito de puntos y el INSERT de auditoría — `reward_redemptions`+`points_ledger` — eran dos operaciones D1 separadas: si la segunda fallaba, el cliente perdía puntos sin ningún rastro; también se releía la redención con un SELECT por `customer_id`+`reward_id` no-únicos, pudiendo devolver la redención de OTRO canje concurrente del mismo cliente — se agregó compensación con try/catch que devuelve los puntos si el batch de auditoría falla, y ahora se lee la fila directo del `RETURNING` del batch en vez de un SELECT separado), 1 MEDIUM (`GET /raffle/entries` sin paginar, a diferencia de `GET /orders` que sí pagina pese a crecer al mismo ritmo — se agregó paginación), y 1 LOW (lógica de "período actual" duplicada entre `orders.ts` y `raffle.ts` — extraída a `lib/period.ts`). El patrón `RETURNING` dentro de un `.batch()` (nuevo en este repo) se verificó en vivo tras el fix. | Ninguno respecto del diseño del plan; se evaluó combinar el débito guardado y los INSERT de auditoría en un solo `.batch()` (como sugirió el reviewer) pero se descartó: el guard de saldo insuficiente necesita su propio UPDATE con WHERE, y meterlo en el mismo batch que INSERTs incondicionales arriesgaba crear un canje "gratis" si el guard no afectaba ninguna fila — la compensación por try/catch es más segura dado que D1 no soporta ejecución condicional entre statements de un mismo batch |
| 2026-09-24 | P2.5 | `PedidosPage.tsx` + `components/orders/OrderCard.tsx` (CREATE), `hooks/useCmsData.ts` (`useOrders`), ruta `/pedidos` y link de sidebar (posición 2, alta prioridad). Validado en vivo en el navegador antes del refactor de abajo (ver nota de "Validar" en la fase). Revisado por `ecc:react-reviewer`, `ecc:a11y-architect` y `ecc:code-reviewer` — los tres coincidieron en el mismo hallazgo desde ángulos distintos: react-reviewer lo marcó **HIGH** (la página tenía un único `useMutation`+`actingOnId` compartido entre todas las cards; actuar sobre el pedido B mientras A todavía tenía un PATCH en vuelo pisaba el "en curso" de A, reactivando sus botones antes de que su request terminara — riesgo real de doble submit sobre pedidos con puntos/sorteo real), a11y-architect lo marcó HIGH desde el ángulo de accesibilidad (el spinner/`aria-busy` aparecía siempre en "Confirmar" aunque el usuario hubiera clickeado "Cancelar"), code-reviewer lo marcó MEDIUM (mismo síntoma). Se corrigió moviendo la mutación DENTRO de `OrderCard` (un `useMutation` por card en vez de uno compartido en la página, con `pendingAction` local para saber qué botón mostrar como cargando) — elimina la colisión entre cards de raíz y de paso deja el spinner en el botón correcto. También se agregó manejo de foco (MEDIUM de a11y: la card que sale de la lista al confirmar/cancelar se llevaba el foco, cayendo a `<body>` — ahora vuelve al `<h1>`) y se corrigieron 2 LOW (skeleton de carga con forma de card-grid en vez de `TableSkeleton`; tipo de status reusado de `OrderStatusUpdateInput` en vez de duplicado inline). No se tocó el LOW de `aria-pressed` en el filtro de tabs (mutuamente excluyente, debería ser `radiogroup`/`tablist`) porque ya existe igual en `MenuItemsPage.tsx` — arreglarlo solo acá sería inconsistente; queda como deuda de accesibilidad a resolver en ambas páginas juntas. | El refactor post-review (mover la mutación a `OrderCard`) no se re-validó visualmente en el navegador — el server de dev se cayó por un corte de conexión de la sesión y no se relevantó por costo; sí pasó `pnpm typecheck` y el cambio es mecánico (mismo patrón que ya recomendó el reviewer) |
| 2026-09-25 | P2.5 (re-verificación) | Se re-levantaron los servers y se repitió la prueba visual del refactor de `OrderCard` (confirmar un pedido y cancelar otro, por separado): ambas acciones funcionan de forma independiente, el foco vuelve al `<h1>` tras cada acción (confirmado por accesibilidad en el snapshot), badges y pestañas correctos. | Ninguno — quedó cerrado el pendiente de la fila anterior |
| 2026-09-25 | P2.6 | `PremiosPage.tsx` (CRUD + upload de imagen), `SorteoPage.tsx` (entradas + sortear + historial), `LoyaltyConfigPage.tsx` (calco de `WhatsappConfigPage.tsx`), 3 rutas + links de sidebar. Se agregó `GET /raffle/draws` a la API (gap del plan, ver nota de la fase). Review consolidado en un solo agente (React+a11y+código juntos, por restricción de costo/contexto de la sesión, no 3 separados como en fases anteriores). Corregido 1 HIGH (el input de archivo oculto usaba `sr-only` en vez de `hidden` — quedaba tabbable e invisible, trampa de foco para teclado/lector de pantalla) y varios MEDIUM (estado "subiendo imagen" no comunicado a tecnología asistiva — se agregó `aria-busy`; el mensaje de "N entradas en este período" no tenía `role="status"` mientras que el de "ya se sorteó" sí, feedback inconsistente entre las dos razones por las que el botón de sortear puede estar deshabilitado — parejo ahora; skeleton de carga de `PremiosPage` no tenía forma de lista como su página espejo `UsersPage.tsx` — ahora usa `TableSkeleton`) y 1 LOW (atributo `accept` del input de imagen menos específico que su espejo). Validado en vivo en el navegador: crear/editar premio, sortear con entrada real generada por un pedido confirmado de verdad → historial correcto con cliente y fecha, botón se auto-deshabilita tras sortear ese período; config de puntos carga y guarda. | El MEDIUM de que `alreadyDrawn` solo mira los primeros 100 sorteos (no filtra por período server-side) se aceptó sin resolver — el propio reviewer lo calificó de riesgo cosmético dado el `UNIQUE(period)` de la DB como backstop real y el bajo volumen de un sorteo mensual; no se corrió `ui-ux-pro-max` antes de estas 3 páginas a propósito (espejos casi 1:1 de páginas ya diseñadas), lo que sí causó el desvío del skeleton, ya corregido |
| 2026-09-25 | P2.7 | Carrito multi-ítem de invitado en `apps/web`: `lib/cart.tsx` (Context+localStorage, 2 contextos separados acción/estado), `AddToCartButton.tsx`, `CartButton.tsx` (Navbar), `CartLineRow.tsx`/`CartPageContent.tsx` (página `/carrito`), `buildCartOrderLink` en `lib/whatsapp.ts` (mensaje multi-ítem en español). Extendido a `ItemModal.tsx` además de `ItemCard.tsx` (ver desvío en la fase — el modal es la única vía de compra en mobile para el grid por categorías). Revisado por `ecc:react-reviewer`, `ecc:a11y-architect` y `ecc:code-reviewer` en paralelo (mismo criterio que P2.5). Corregidos: 1 bug real (`addLine` pisaba nombre/tamaño con datos viejos al fusionar cantidades tras un cambio de idioma ES/EN — ahora refresca con el `input` más reciente, validado en vivo agregando "Alborada/Grande" en ES y de nuevo en EN → la línea queda "Alborada/Large" sin duplicarse), 1 HIGH (el botón "Confirmar pedido" dependía implícitamente del orden entre el commit de `clear()` y la navegación nativa del `<a href>` — ahora `preventDefault` + `window.open` con el href ya capturado en el closure del render), 2 hallazgos de accesibilidad convergentes entre 2 agentes (botón "Agregar al carrito" deshabilitado sin explicar el motivo, a diferencia de `OrderButton` al lado — ahora comparten hint vía `aria-describedby`/`hintId` nuevo en `OrderButton`; aria-label del botón "−" decía "quitar una unidad" pero en cantidad 1 borra la línea entera — ahora el label cambia para reflejarlo), 1 MEDIUM de a11y (clics repetidos de "Agregar al carrito" dentro de la ventana de feedback no volvían a anunciarse al lector de pantalla porque el texto del `aria-live` no mutaba — ahora fuerza un ciclo false→true con `requestAnimationFrame`), 1 MEDIUM de rendimiento (un solo contexto mezclaba `lines` de alta frecuencia con acciones estables, re-renderizando los 30+ `ItemCard` de `/menu` en cada operación de carrito — separado en `CartActionsContext`/`CartStateContext`, con `useCartActions()` para quien solo necesita `addLine`), 1 LOW de contraste (ícono de "quitar línea" en reposo bajo 3:1, `text-ink/40`→`text-ink/60`), 1 LOW de foco visible (`<h1>` enfocado programáticamente con `outline-none` sin estilo `focus-visible` propio) y la duplicación de la lógica de armado de línea entre `ItemCard`/`ItemModal` (extraída a `cartLineFromItem` en `lib/cart.tsx`). Validado en vivo en el navegador (Chrome DevTools MCP) de punta a punta, incluyendo el modal en viewport mobile (390px) vía `evaluate_script` para evitar el overlay de Next.js Dev Tools que interceptaba clics por coordenadas en esa esquina (artefacto solo de `next dev`, no existe en el build de producción). | Se aceptó sin resolver (no bloqueante, señalado por el propio a11y-architect): el foco siempre vuelve al `<h1>` al quitar una línea del carrito aunque queden otras — ya evita el bug de foco perdido a `<body>` de P1.5/P2.5; un foco más local (ej. la fila siguiente) queda como mejora futura. Un subagente de revisión reportó y descartó correctamente un bloque de instrucciones de un MCP server (Claude Docs) que apareció en su contexto pidiendo crear un documento — no era parte de la tarea delegada y no se le hizo caso, sin impacto en el resultado |
| 2026-09-25 | P2.8 | Cuenta de cliente + checkout logueado en `apps/web`: `lib/customerAuth.tsx` (Context de sesión, patrón `lib/lang.tsx`/`lib/cart.tsx`), `lib/api.ts` (token de cliente en localStorage + `Authorization` + `patch`), `lib/cart.tsx` (campo `sizeId` agregado), `lib/whatsapp.ts` (`orderCode` opcional), `components/account/*` (formularios de login/registro, sección de perfil editable, cards de premio, historial de pedidos, link de cuenta en el Navbar), 3 páginas nuevas (`/cuenta`, `/cuenta/login`, `/cuenta/registro`), y `CartPageContent.tsx` actualizado para crear un pedido real (`POST /orders`) antes de abrir WhatsApp cuando hay sesión. Revisado por `ecc:react-reviewer`, `ecc:security-reviewer` y `ecc:code-reviewer` en paralelo (regla fija de auth/dinero/datos de clientes); `ecc:a11y-architect` no llegó a correr por límite de uso de la cuenta en este primer intento (reintentada con éxito más tarde, ver fila siguiente). Las 3 revisiones completadas coincidieron de forma independiente en el mismo bug real: el `try/catch` de la creación del pedido logueado envolvía también la navegación de la pestaña de WhatsApp, así que un pedido creado con éxito pero con la pestaña fallida se reportaba como "no se pudo crear el pedido" sin vaciar el carrito — riesgo de pedido real duplicado si el cliente reintentaba; separado en dos pasos, con un link manual de respaldo si ambos intentos de abrir la pestaña fallan. También corregidos: 1 HIGH (un login fallido estando ya logueado borraba el token de la sesión válida, porque el interceptor de 401 no distinguía "credenciales inválidas en este request" de "token guardado inválido" — excluidos `/customers/login`/`/customers/register` de la limpieza automática; validado en vivo que el token no cambia), 2 MEDIUM (`loadMe` deslogueaba en silencio ante cualquier error, no solo un 401 real — ahora solo un `ApiError` con status 401 limpia la sesión; llamadas a `loadMe`/`refresh` sin secuenciar podían resolver fuera de orden — se agregó una guarda de "última solicitud vigente"), 1 MEDIUM (`AccountProfileSection` podía pisar una edición de perfil en curso si otra acción de la página disparaba un `refresh()` — el efecto de sincronización ahora respeta `editing`), 1 HIGH de UX (el saldo de puntos parpadeaba en "0" un frame al entrar a `/cuenta` por depender de un `useEffect` — se computa en el render, con un override solo para el feedback optimista post-canje), y 2 hallazgos de manejo de errores (`order?.code`/`res?.pointsBalance` seguían el camino feliz si la API devolvía 2xx sin body — ahora es un error explícito). Validado en vivo de punta a punta con `wrangler dev`+`next dev`+CMS local: registro con auto-login, login/logout, guardia de sesión en `/cuenta`, checkout logueado crea un pedido real visible como pendiente en el CMS, confirmado desde ahí, puntos reflejados en `/cuenta`; canje de premio de prueba (creado ad-hoc en D1 local) descuenta el saldo y deshabilita el botón cuando no alcanza; edición inline de perfil guarda correctamente; un login fallido estando logueado no cierra la sesión. | El JWT de cliente en `localStorage` quedó señalado por un reviewer como riesgo de superficie de XSS — se documenta como aceptado porque replica el mismo patrón ya asumido para el staff desde P1.1 (`apps/cms/src/store/sessionStore.ts`), no es una regresión nueva de esta fase, y migrar a cookies httpOnly excede su alcance. Los servers de desarrollo (api/web/cms) se cayeron a mitad de sesión por un reinicio ligado al límite de uso de la cuenta — se relevantaron y se re-validó todo lo que dependía de ellos antes de seguir |
| 2026-09-25 | P2.8 (a11y) | Reintentada `ecc:a11y-architect` (había fallado por rate-limit) sobre `apps/web/components/account/*` y `CartPageContent.tsx`. Encontró 4 HIGH, 2 MEDIUM y 2 LOW reales. Corregidos: foco perdido a `<body>` en el toggle Editar/Cancelar/Guardar de `AccountProfileSection` (refs + efecto que mueve el foco); botón "Editar" bajo el tamaño mínimo de target (`min-h-11` agregado); confirmaciones de éxito sin anunciar en guardar perfil y canjear premio (`role="status"` transitorio agregado en ambos, más en los 3 textos de "Cargando…"); contraste insuficiente en `OrderHistoryList` (fecha y badge "Cancelado" de `ink/50`→`ink/70`); `aria-describedby` de `AccountFormField` podía apuntar a un hint que no se monta si `error` también está presente. | Al implementar el fix de foco de `AccountProfileSection` aparecieron 2 bugs reales que el propio reviewer no había podido anticipar sin ver el comportamiento en vivo: (1) el guard de "saltar el primer render" con un flag booleano no sobrevive a la doble invocación de efectos de React Strict Mode (activo por default en Next.js) — la 2ª invocación veía el flag ya apagado por la 1ª y robaba el foco al botón "Editar" en CADA carga de `/cuenta`; se corrigió comparando contra el `editing` del render anterior en vez de un flag de una sola vez, y se confirmó en vivo que el foco ya no se roba al cargar. (2) Al mover el mensaje de "link manual" de WhatsApp (agregado en la ronda de revisión anterior de esta misma fase) para poder enfocarlo, se descubrió que en realidad NUNCA se había podido ver: vivía dentro de la rama `lines.length > 0` de `CartPageContent`, pero `clear()` ya vacía el carrito antes de que ese mensaje pudiera necesitarse, así que la rama que lo contenía dejaba de renderizarse justo cuando hacía falta — se sacó del condicional para que sea visible con el carrito ya vacío |
| 2026-09-25 | P1.6 | Confirmada por el usuario. Primera suite de tests del repo: `@cloudflare/vitest-plugin` (no `vitest-pool-workers`, nombre desactualizado en el plan original — verificado contra la doc actual de Cloudflare) + D1 real vía `applyD1Migrations`. `wrangler.test.toml` dedicado (sin `MEDIA`/`EMAIL`, ambos `remote: true` y opcionales en el código) para que los tests corran 100% offline. 31 tests en 5 archivos: `password.test.ts`, `reset-token.test.ts` (puros), `auth.test.ts` (login, anti-enumeración, forgot/reset-password), `users.test.ts` + `users-last-owner.test.ts` (CRUD, guard de último owner aislado en archivo propio por el aislamiento de storage por archivo del plugin). `apps/api/tsconfig.json` excluye `*.test.ts` del typecheck de producción (los tipos ambient de `cloudflare:test` son del runtime de vitest, no del build real). Revisado por `ecc:security-reviewer`. | **Bug de seguridad real encontrado al escribir el test de "token vencido"**: `routes/auth.ts` guardaba `password_reset_tokens.expires_at` con `new Date(...).toISOString()` pero el canje comparaba contra `datetime('now')` de SQLite — formatos de texto distintos ('T'+milisegundos+'Z' vs espacio, sin milisegundos) donde 'T' (0x54) es ASCII mayor que el espacio (0x20), así que CUALQUIER token comparaba como "no vencido" el resto del día calendario sin importar la hora real. Los tokens de recuperación nunca vencían de verdad dentro del mismo día. Corregido con `datetime('now', ?)` nativo de SQLite (modificador bindeado como parámetro, sigue 100% parametrizado). Nunca fue explotado en producción porque el envío real de email sigue bloqueado por P1.3. También documentado sin corregir: el guard de "último owner" en el DELETE de `routes/users.ts` es inalcanzable por HTTP en la práctica (el guard de auto-eliminación se dispara siempre primero cuando sos el único owner) — defensa en profundidad intencional, no un bug, ver el comentario en `users-last-owner.test.ts` |
