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
| P1.5 | CMS | Pantallas de recuperación de contraseña | P1.4 | ⬜ Pendiente | |
| P1.6 | API | (Opcional) Tests de la superficie nueva de auth | P1.4 | ⬜ Pendiente | |
| P2.1 | API/DB | Migración `loyalty` + tipos/schemas compartidos | P1.2 | ⬜ Pendiente | |
| P2.2 | API | Auth de clientes (`customers`, JWT separado) | P2.1 | ⬜ Pendiente | |
| P2.3 | API | Pedidos (`orders`) + confirmación atómica | P2.2 | ⬜ Pendiente | |
| P2.4 | API | Premios, sorteo y config de puntos | P2.3 | ⬜ Pendiente | |
| P2.5 | CMS | Página "Pedidos" | P2.3 | ⬜ Pendiente | |
| P2.6 | CMS | Páginas "Premios" / "Sorteo" / config de puntos | P2.4 | ⬜ Pendiente | |
| P2.7 | Web | Carrito (funciona sin cuenta) | — | ⬜ Pendiente | |
| P2.8 | Web | Cuenta de cliente + checkout logueado | P2.2, P2.3, P2.7 | ⬜ Pendiente | |

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

- **Estado**: ⬜ Pendiente
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

### P1.6 — (Opcional, a confirmar) Tests de la superficie nueva de auth

- **Estado**: ⬜ Pendiente — **requiere confirmación explícita del usuario**, ver nota abajo.
- **Archivos**: `apps/api/vitest.config.ts` (CREATE), `apps/api/src/lib/password.test.ts`,
  `reset-token.test.ts`, `routes/auth.test.ts`, `routes/users.test.ts` (CREATE).
- **Nota**: este repo no tiene test runner por decisión consciente original (documentado en
  `BLUEPRINT.md`/`README.md`). Las reglas globales del usuario piden tests obligatorios en
  código de auth; esta fase los acota SOLO a la superficie nueva/sensible en vez de imponer
  una suite completa sobre código que ya funciona en producción. Confirmar si se incluye.
- **Skills/Agentes**: `ecc:tdd-guide` (agente) si se confirma.
- **Validar**: `pnpm --filter @sabor/api test`.

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

- **Estado**: ⬜ Pendiente
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

- **Estado**: ⬜ Pendiente
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

- **Estado**: ⬜ Pendiente
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

- **Estado**: ⬜ Pendiente
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

### P2.7 — Web: carrito (sin cuenta)

- **Estado**: ⬜ Pendiente
- **Archivos**: `apps/web/lib/cart.tsx` (CREATE: Context+`localStorage`, mismo patrón
  hidratación-segura que `lib/lang.tsx` — verificado línea por línea, default en servidor y
  valor real recién en `useEffect` para no romper el export estático),
  `apps/web/components/cart/CartButton.tsx` (CREATE), `apps/web/app/carrito/page.tsx`
  (CREATE), `apps/web/components/menu/ItemCard.tsx` (UPDATE, `ItemCard.tsx:198-208` — el
  bloque de `OrderButton` gana al lado un control "Agregar al carrito"), `apps/web/lib/whatsapp.ts`
  (UPDATE: nueva función para armar un mensaje multi-ítem, además de `buildItemOrderLink`
  existente que se conserva para el pedido directo de un ítem suelto).
- **Nota**: esta fase NO depende de cuentas de cliente — funciona para invitados de punta a
  punta y no cambia el comportamiento actual salvo agrupar "N ítems → 1 WhatsApp".
- **Skills/Agentes**: `ui-ux-pro-max` (carrito es UI de cara al cliente, la de mayor
  visibilidad de todo el plan) · `ecc:react-reviewer` · `ecc:frontend-a11y`/`ecc:accessibility`
  (carrito con foco/teclado accesible).
- **Validar**: agregar varios ítems sin sesión → confirmar → un solo WhatsApp con el resumen
  correcto y ningún registro nuevo en D1.

### P2.8 — Web: cuenta de cliente + checkout logueado

- **Estado**: ⬜ Pendiente
- **Archivos**: `apps/web/lib/customerAuth.tsx` (CREATE, Context, mismo patrón que
  `lib/lang.tsx` — sin agregar Zustand a `apps/web`, que hoy no lo tiene y no lo necesita),
  `apps/web/lib/api.ts` (UPDATE: hoy solo expone `get`/`post` — agregar `patch` y adjuntar
  `Authorization` cuando haya sesión de cliente, mismo criterio que ya usa `apps/cms/src/lib/api.ts`),
  `apps/web/app/cuenta/login/page.tsx`, `.../registro/page.tsx`, `.../page.tsx` (perfil: saldo
  de puntos, historial, catálogo de premios + canje) (CREATE).
- **Skills/Agentes**: `ui-ux-pro-max` antes de cada pantalla nueva · `ecc:react-reviewer` ·
  `ecc:security-review` (formularios de registro/login del lado cliente) · `ecc:accessibility`.
- **Validar**: registrarse → loguearse → agregar al carrito → confirmar → pedido en estado
  `pending` visible en CMS (P2.5) → dueño confirma → puntos reflejados en `/cuenta`.

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
| Alcance grande (14 fases, 3 apps) puede perder continuidad entre sesiones de Claude | 1 y 2 | Media | Este mismo documento — actualizar estado/changelog es obligatorio por instrucción al inicio del archivo |

## Criterios de aceptación globales

- [ ] Parte 1 y Parte 2 completas según sus criterios por fase.
- [ ] `pnpm typecheck` y `pnpm lint` pasan en todo el monorepo.
- [ ] Ningún precio ni saldo de puntos se confía del cliente — todo recalculado/validado server-side.
- [ ] Cero secretos nuevos innecesarios (email vía binding nativo, no SMTP con credenciales).
- [ ] JWT de cliente y de staff son estructuralmente incompatibles entre sí.
- [ ] Este documento refleja el estado real al final de cada sesión de trabajo.

## Registro de cambios

| Fecha | Fase(s) | Qué se hizo | Desvíos del plan original |
|---|---|---|---|
| 2026-09-24 | — | Creación de este documento (fusión del plan de seguridad de cuentas admin + el plan de cuentas de cliente/carrito/puntos/sorteo) | Renumeración de migración `0003`→`0004` para lealtad; namespace `2003` reasignado a `CUSTOMER_AUTH_LIMITER`; `ON DELETE` de FKs hacia `users` fijado explícitamente en el esquema de lealtad |
| 2026-09-24 | P1.1 | Modal "Editar usuario" en `UsersPage.tsx` (Nombre/Rol/Contraseña opcional) sobre el `PATCH /users/:id` ya existente. Revisado por `ecc:react-reviewer` y `ecc:code-reviewer`; 3 issues HIGH encontrados y corregidos: (1) autoedición vía el modal bumpea `token_version` y desloguea sin aviso — el botón "Editar" ahora se oculta para el propio usuario, igual que "Eliminar"; (2) ids de DOM duplicados con el form de "Nuevo admin" (`id="Nombre"`/`id="Rol"` por el fallback de `FormField`) — se separó el formulario en `EditUserForm` con ids explícitos (`edit-user-*`); (3) flash de datos del usuario anterior por sincronizar state vía `useEffect` — reemplazado por `key={user.id}` + `useState` lazy en `EditUserForm`. `pnpm typecheck` OK. | Se extrajo `EditUserForm` como subcomponente (no estaba en el plan original, pero necesario para resolver el ids-duplicados + flash de forma correcta) |
| 2026-09-24 | P1.2 | Migración `0003_password_reset_tokens.sql` (tabla + índice por `user_id`), aplicada en local (`wrangler d1 migrations apply --local`). Revisada por `ecc:code-reviewer`: aprobada sin issues (solo nota LOW no accionable — índice de `expires_at` es YAGNI hasta que exista un job de limpieza). | Ninguno |
| 2026-09-24 | P1.3 (parcial) | Binding `EMAIL` (`send_email`) agregado a `wrangler.toml` (dev + producción), tipo `SendEmail` en `env.ts`, guard de producción en `index.ts`. Fase queda **bloqueada**: falta que el usuario habilite el dominio real en Cloudflare Email Sending (`wrangler email sending enable`), acción que requiere su login/DNS y no es automatizable desde la sesión. | El skill `cloudflare-email-service` corrigió el supuesto original del plan: la API 2025 es `env.EMAIL.send({...})`, no un `EmailMessage`/MIME manual |
| 2026-09-24 | P1.3 (investigación) | Usuario intentó habilitar el dominio vía `wrangler email sending enable` (CLI) → `Unauthorized [code: 2036]` (bug conocido del token OAuth de `wrangler login` con este endpoint beta). Redirigido a Dashboard → confirmó que Email Sending a destinatarios arbitrarios requiere plan Workers Paid ($5/mes); Email Routing (gratis) es un producto distinto que NO habilita el binding de sending. Usuario decidió pausar P1.3 y seguir con otras fases. | Ninguno en código; deja la fase explícitamente en manos del usuario (pagar plan, verificar direcciones destino gratis, o seguir pausada) |
| 2026-09-24 | P1.4 | Endpoints `POST /auth/forgot-password` y `POST /auth/reset-password` en `routes/auth.ts` + `lib/reset-token.ts` (token de 32 bytes random, hash SHA-256 base64url) + schemas/DTOs en `packages/shared`. Revisado por `ecc:security-reviewer` y `ecc:code-reviewer`. Corregido 1 issue MEDIUM (timing side-channel: el `DB.batch()` de invalidación solo corría cuando el usuario existía, delatando por tiempo de respuesta si el email existe pese a que el mensaje de respuesta es idéntico — ahora las 2 DELETE corren siempre en ambas ramas, solo el INSERT queda condicional) y 2 LOW (token del link ahora va en fragment `#token=` en vez de query string; `resetPasswordSchema.token` con `.max(200)`). `pnpm typecheck` OK en `@sabor/api` y `@sabor/shared`. También se corrigió el header obsoleto de `dto.ts` que el propio plan marcaba como desviado ("aún no implementada — fase 3"). | Ninguno respecto del diseño de P1.4; nota agregada a P1.5 para que `ResetPasswordPage.tsx` lea el token de `window.location.hash`, no de query params |
