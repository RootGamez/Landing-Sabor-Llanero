# Plan Parte 3 — Back-office: POS, Gastos y Dashboard

Documento vivo. Continúa [`PLAN_IMPLEMENTACION.md`](./PLAN_IMPLEMENTACION.md) (Partes 1 y 2) y
aplica las **mismas instrucciones para Claude** de su encabezado (leer antes de tocar código,
marcar fases, registrar desvíos, skills/agentes obligatorios). Aprobado por el dueño el
2026-11-22 con las recomendaciones por defecto de la §9 del plan.

> Textos de UI: español neutro con tuteo (público de Pisco, Perú). Nada de voseo.
> Commits: conventional commits, **sin** línea `Co-Authored-By`.
> **Nunca** aplicar migraciones remotas ni desplegar sin confirmación explícita del dueño.

## Capacidad

El dueño registra ventas de mostrador en un POS táctil rápido, cierra la caja y obtiene un
resumen en imagen (PNG) para compartir; anota/importa egresos; y ve en un dashboard
ingresos, egresos, utilidad y productos más vendidos. El historial de Aronium (ventas
2024-08-15 → 2025-04-22) y HomeBank (2025-05-25 → hoy) se migra sin perder lo importante.
El CMS actual pasa a ser el módulo **Tienda online**.

## Decisiones fijas (no re-litigar)

| # | Decisión |
|---|---|
| D1 | Dinero en **céntimos `INTEGER`** en todas las tablas nuevas (`*_cents`). Tablas viejas (`REAL`) no se tocan; conversión solo vía `toCents`/`fromCents` de `packages/shared`. |
| D2 | Zona horaria **`America/Lima` (UTC-5 fijo, sin DST)**. Timestamps se guardan en UTC (`datetime('now')`, como el resto del repo); toda agrupación por día usa `localDate()` de `shared` (o `date(created_at, '-5 hours')` en SQL). |
| D3 | El "día" de ventas = **sesión de caja** (`cash_sessions`). Solo una abierta a la vez (índice único parcial). No se vende sin caja abierta. |
| D4 | Ventas **no se borran: se anulan** (`voided_at`, `voided_by`, `void_reason`). Anular: admin/owner con caja abierta; owner siempre. |
| D5 | Snapshot de nombre/tamaño/precio en `sale_items` (como `order_items`). |
| D6 | El POS vende `menu_items` × `sizes` (fuente única de precios, reutiliza `pricing.ts` de shared). Nueva columna `menu_items.channel` `'both'|'web'|'pos'` (default `'both'`); la web pública filtra `channel IN ('both','web')`. |
| D7 | Ingresos del dashboard = **solo `sales` no anuladas**. Un pedido web confirmado se cobra desde el POS ("Cobrar pedido web") y queda enlazado `sales.order_id` (UNIQUE) → sin doble conteo. |
| D8 | Métodos de pago: tabla `payment_methods` con `efectivo, yape, plin, tarjeta, transferencia`. Un método por venta. |
| D9 | Rol nuevo **`cashier`**: solo POS (abrir/vender/cerrar caja). No ve gastos, dashboard financiero ni Tienda/Ajustes. `owner` y `admin` ven todo (Usuarios sigue solo owner). |
| D10 | Gastos con borrado lógico (`deleted_at`). Campo `paid_from_register` descuenta del efectivo esperado de la sesión abierta. |
| D11 | Importaciones **idempotentes**: `legacy_ref`/`import_hash` UNIQUE. Reimportar no duplica. |
| D12 | Descuentos: solo `discount_cents` opcional a nivel venta (Aronium tiene 0 descuentos en 3 278 líneas). |
| D13 | Modo offline (cola IndexedDB) **fuera de esta parte** — fase futura P3.F4b si el dueño lo pide. Las ventas llevan `client_uuid` UNIQUE desde ya para hacerlo posible sin migración. |
| D14 | POS a pantalla completa (sin sidebar), botón "Salir". |
| D15 | Pago por defecto Yape; cierre sin cuadrar opcional, por defecto. `createSaleSchema.paymentMethod` es opcional y la API usa `DEFAULT_PAYMENT_METHOD = 'yape'` (el POS no preselecciona nada); `cash_received_cents` solo con efectivo explícito. `closeSessionSchema.reconcile` (default `false`): sin cuadrar se guardan `counted_cash_cents` y `expected_cash_cents` en NULL y el snapshot lleva `reconciled: false` sin esperado/contado/diferencia (`countedCashCents` con `reconcile=false` → 400). Snapshots viejos/importados sin `reconciled` valen como cuadrados. |
| D16 | **Ventas = solo Aronium; HomeBank = solo egresos.** Con el backup real (9 272 ventas, 2024-08-15 → 2026-11-21, S/ 527 839,40) se comprobó que los ingresos de HomeBank son las mismas ventas anotadas a mano: coinciden exacto en 463 de 513 días, y las diferencias son redondeos o fechas corridas un día (p. ej. 12/10/2025 y 18/03/2026). Importar ambos duplicaría ingresos. El importador de HomeBank trae los ingresos **desmarcados por defecto** (también al reiniciar el asistente). |

## F0 — Datos reales (✅ inspeccionados 2026-11-22)

> ⚠️ El `pos.db` inspeccionado **NO es el backup real/actualizado**: sirve solo para diseñar
> esquema y mapeo. **Antes de ejecutar F8, pedirle al dueño el backup actualizado de Aronium**
> y volver a correr la inspección (conteos/rango de fechas) sobre ese archivo.

**Aronium** (`pos.db`, SQLite; copia de diseño en `OneDrive/Documentos/pos.db`, NO versionar):
- `Document` 2 392 filas, **todas `DocumentTypeId=2` (Sales)**, total S/ 103 853,50.
  `Date` es solo fecha; `DateCreated` trae hora local (`2025-04-22 22:32:10.2184`).
- `DocumentItem` 3 278 filas: `ProductId, Quantity, Price, Total`; 0 descuentos.
- `Payment` 2 392 filas, 1 por documento, **todas `PaymentTypeId=1` (Cash)**.
- `ZReport` 227 filas: `Number, FromDocumentId, ToDocumentId, DateCreated` → **sesiones de caja reales**.
- `Product` 88 filas; `ProductGroup`: Pizzas medianas / Pizzas Grandes / Pizzas Familiares /
  Pastas / Promos / Bebidas / Entradas. **El tamaño está en el grupo**: (grupo pizza, nombre)
  → (`menu_item` por nombre normalizado, `size` mediana/grande/familiar).
- Encoding: algunos nombres vienen con bytes rotos (`Champi�on`) → normalizar (NFKD, sin
  acentos, lower) y dejar los no resueltos en el CSV de mapeo.
- **91 líneas con cantidad fraccionaria** (medias porciones: Tequeños ×0.5, Pan al Ajo ×1.5…). `sale_items.quantity` es INTEGER con CHECK `line_total = unit_price × quantity`: el importador las guarda como `quantity=1`, `unit_price_cents = line_total_cents`, `name = "<nombre> (×0,5)"`. Totales intactos.
- Ignorar: Stock, Customer, Warehouse, FloorPlan, PosVoid, Tax, User.

**HomeBank** (`Downloads/Homebank/Sabor  Llanero.xhb`, XML nativo; NO versionar):
- 1 096 `<ope>`; fechas `date` = ordinal juliano (Python `date.fromordinal`), 2025-05-25 → 2026-11-14.
- Egresos: categoría `Compras` (577 ops, ≈ S/ 262 770), payee `Sabor Llanero - Compra`/`senati`.
- Ingresos (positivos): categorías `Ventas` / `Ingresos / Interés` / `Otros Ingresos`
  (519 ops, ≈ S/ 400 869) = **total de ventas del día**, sin detalle de producto.
- Sin `paymode` ni `memo` útiles; `wording` = "Importación automática" o vacío.
- Categorías: `<cat key parent name>`; subcategoría → `Padre:Hija`.

**Consecuencias en el diseño:**
- Importador HomeBank acepta **`.xhb` y `.csv`** (CSV de HomeBank: `;`, columnas
  `date;payment;info;payee;memo;amount;category;tags`).
- Negativos → `expenses`. Positivos → **venta resumen** en `sales` (`source='homebank'`, un
  `sale_item` "Venta del día (resumen)") dentro de una `cash_session` histórica cerrada por día.
  Así el dashboard tiene ingresos continuos desde 2024-08.
- Aronium → script local (volumen y SQLite), HomeBank → UI (recurrente).

## Modelo de datos

`0009_backoffice.sql` (una migración; usar skill `ecc:database-migrations`):

```sql
-- users.role: agregar 'cashier' (requiere rebuild de tabla, ver patrón 0005)
-- menu_items: ADD COLUMN channel TEXT NOT NULL DEFAULT 'both' CHECK (channel IN ('both','web','pos'))

payment_methods (key TEXT PK, label TEXT, display_order INT, is_active INT)

cash_sessions (id, opened_at, opened_by FK users SET NULL, opening_cash_cents INT >=0,
  closed_at NULL, closed_by NULL, counted_cash_cents NULL, expected_cash_cents NULL,
  notes, close_snapshot_json NULL, source 'pos'|'aronium'|'homebank', legacy_ref UNIQUE NULL)
  UNIQUE INDEX one_open ON cash_sessions((1)) WHERE closed_at IS NULL

sales (id, session_id FK RESTRICT, number INT (correlativo por sesión), created_at, created_by,
  subtotal_cents, discount_cents DEFAULT 0, total_cents, payment_method FK, cash_received_cents NULL,
  order_id NULL UNIQUE FK orders, client_uuid UNIQUE NULL, voided_at, voided_by, void_reason,
  source 'pos'|'aronium'|'homebank', legacy_ref UNIQUE NULL)
  INDEX (session_id), (created_at)

sale_items (id, sale_id FK CASCADE, item_id NULL FK SET NULL, size_id NULL, name, size_label NULL,
  unit_price_cents >0, quantity >0, line_total_cents)

expense_categories (id, name, parent_id NULL FK, color NULL, is_active, UNIQUE(parent_id,name))
expenses (id, date TEXT 'YYYY-MM-DD' local, amount_cents >0, category_id FK RESTRICT,
  description DEFAULT '', payment_method FK, paid_from_register INT, session_id NULL,
  source 'manual'|'homebank', import_hash UNIQUE NULL, created_by, created_at, deleted_at NULL)
  INDEX (date), (category_id)

legacy_product_map (source 'aronium', legacy_id, legacy_name, legacy_group, item_id NULL, size_id NULL,
  PK(source, legacy_id))
```

Seed: payment_methods; expense_categories base (Insumos, Bebidas, Gas, Personal, Servicios,
Alquiler, Delivery, Mantenimiento, Otros).

## Navegación (CMS)

```
Inicio        /                      Dashboard general (owner/admin)
Ventas        /ventas/pos            POS (fullscreen) — todos los roles
              /ventas/cierres        Cierres de caja + imagen
              /ventas/historial      Ventas (filtros, anular)
Gastos        /gastos                Registrar + historial
              /gastos/importar       HomeBank .xhb/.csv
              /gastos/categorias
Tienda online /tienda/pedidos /tienda/menu /tienda/categorias /tienda/destacados
              /tienda/premios /tienda/sorteo /tienda/puntos /tienda/whatsapp
Reportes      /reportes
Ajustes       /ajustes/usuarios (owner) /ajustes/perfil
```
Rutas viejas (`/menu`, `/pedidos`, …) → `<Navigate replace>` a las nuevas. `cashier` al
loguear aterriza en `/ventas/pos`.

## Fases

| Fase | Qué | Skills/agentes | Estado |
|---|---|---|---|
| F0 | Inspección de datos reales | — | ✅ 2026-11-22 |
| F1 ✅ 2026-11-22 | Shell modular: `NAV_GROUPS` en Sidebar, rutas `/ventas /gastos /tienda /ajustes` con redirects, layout fullscreen POS, guard por rol (`RequireRole` multi-rol), páginas placeholder | `ui-ux-pro-max` → `ecc:react-reviewer` | ⬜ |
| F2 ✅ 2026-11-22 | Migración 0009 + seed + tipos/Zod/helpers en `shared` (`money.ts` toCents/fromCents/formatPEN, `localDate.ts`, `backoffice.ts` schemas) + tests unitarios; rol `cashier` en `Role` | `ecc:database-migrations`, `tdd-workflow` | ⬜ |
| F3 ✅ 2026-11-22 | API POS: `/api/cash-sessions` (current, open, close→snapshot, list, get), `/api/sales` (create atómico con `DB.batch`, precios recalculados server-side, void, list paginado), "cobrar pedido web". Tests de integración | `tdd-workflow`, `ecc:security-reviewer` | ⬜ |
| F4 | UI POS: grilla por categoría (botones grandes, color), selector de tamaño, ticket +/−, método de pago 1 toque, vuelto, atajos teclado, abrir caja si no hay | `ui-ux-pro-max`, `ecc:frontend-a11y` → `ecc:react-reviewer` | ⬜ |
| F5 ✅ 2026-11-22 | Cierre de caja: conteo efectivo, esperado vs contado, desglose por método, top productos, gastos de caja; PNG en cliente (`html-to-image`) + Web Share API (WhatsApp) / descarga; historial de cierres con regenerar imagen | `ui-ux-pro-max`, `dataviz` → `ecc:react-reviewer` | ⬜ |
| F6 ✅ 2026-11-22 | Gastos: API CRUD (+categorías) y UI de registro rápido (monto, categoría, nota, método, "de caja") + lista filtrable | `tdd-workflow`, `ui-ux-pro-max` → `ecc:react-reviewer` | ⬜ |
| F7 ✅ 2026-11-22 | Importador HomeBank `.xhb`/`.csv`: parser puro en `shared` con tests (fixtures sintéticos, no datos reales), preview + mapeo de categorías en UI, endpoint `/api/imports/homebank` (dry-run + commit, lotes) | `tdd-workflow`, `ecc:security-reviewer` | ⬜ |
| F8 | **⛔ Bloqueante: pedir al dueño el backup actualizado de Aronium antes de importar.** Migración Aronium: `apps/api/scripts/import-aronium.ts` (lee pos.db read-only) → reporte de cuadre + `legacy_product_map.csv` editable → SQL en lotes → aplicar `--local` y validar totales al céntimo. Remoto **solo con OK del dueño** | `ecc:database-migrations`, `ecc:verification-loop` | ⬜ |
| F9 ✅ 2026-11-22 | Dashboard: `/api/reports/summary` (ingresos, egresos, utilidad, ticket promedio, # ventas, vs período anterior), `/top-products`, `/sales-by-hour`, `/sales-by-weekday`, `/expenses-by-category`, `/sales-by-payment`; rangos hoy/semana/mes/custom en hora Lima | `ecc:dashboard-builder`, `dataviz`, `ui-ux-pro-max` → `ecc:react-reviewer` | ⬜ |
| F10 ✅ 2026-11-22 | E2E Playwright (caja→venta→anular→gasto→cierre→imagen; import HomeBank), revisión de seguridad y código final, docs | `ecc:e2e-testing`, `ecc:code-reviewer`, `ecc:security-reviewer` | ✅ |

Orden: F1 ∥ F2 → F3 → F4 → F5 ∥ F6 → F7 → F8 → F9 → F10.

## Criterios de aceptación globales

Verificados el 2026-11-22 (F10):

- [x] `pnpm typecheck`, `pnpm lint` y `pnpm --filter @sabor/api test` pasan. *Evidencia:* typecheck de los 5 paquetes (incluye `tsc -p apps/cms/e2e`) y lint con salida 0; api 366/366 tests (18 archivos); shared 286/286 (11 archivos); `test:aronium` 44/44 (4 archivos).
- [x] Ningún precio/total del POS se confía del cliente: recalculado server-side. *Evidencia:* `sales.test.ts` "recalcula precios server-side e ignora los que manda el cliente" (manda `unitPriceCents: 1` y se guarda 3 000); `createSaleSchema` solo acepta ids + cantidades; los CHECK de 0009 son la red de seguridad; revisado por security-reviewer.
- [x] Totales importados de Aronium cuadran al céntimo con `SUM(Document.Total)`. *Evidencia:* F8a, contra el `pos.db` de **diseño** (`e2e.script-test.ts`, parte de los 44 de `test:aronium`: aplica 0001..0009 en SQLite en memoria y compara totales). **La importación real sigue bloqueada (F8) esperando el backup actualizado de Aronium del dueño**; al llegar hay que repetir la inspección y el cuadre sobre ese archivo.
- [x] Reimportar el mismo `.xhb` reporta 0 nuevos. *Evidencia:* `imports.test.ts` (2.º commit = 0 nuevos) y E2E `04-importar-homebank` (UI: "Ya existen 3 gastos y 2 ventas… se omitirán", botón Importar deshabilitado).
- [x] Un cajero no puede leer `/api/expenses` ni `/api/reports/*` (403). *Evidencia:* `pos-access.test.ts` (matriz de 35 rutas) y E2E `03-cajero-restricciones` (redirección a `/ventas/pos` desde `/`, `/gastos`, `/ajustes/usuarios`).
- [x] Datos reales (`pos.db`, `.xhb`) nunca se commitean. *Evidencia:* `.gitignore` (`*.db`, `*.xhb`, `legacy-import/`) y `git log --all` sin ningún `.db`/`.xhb` real; el único `.xhb` versionable es el fixture sintético `apps/cms/e2e/fixtures/homebank-demo.xhb` (excepción explícita en `.gitignore`; **sin esa excepción un clon limpio no tenía el fixture y el E2E (d) fallaba**). Nota: `apps/api/seed.sql` (carta real, pública) aparece en el historial aunque hoy está ignorado; no es dato financiero.

**E2E (F10):** 6/6 pasan, dos corridas seguidas sin flaky (`pnpm --filter @sabor/cms test:e2e`, ~1,5 min; base aislada en `apps/cms/e2e/.state`, API :8791, CMS :5193, ambos puertos se liberan al terminar).

## Pendientes post-F10

Revisión final (security-reviewer sobre `apps/api` + `packages/shared`, code-reviewer sobre toda la rama): **0 CRITICAL, 0 HIGH**. Aplicado: el carrito del POS se vacía al cerrar sesión (`sessionStore.logout`; MEDIUM del code-reviewer: un ticket a medias lo heredaba el siguiente usuario de la pestaña). Sin aplicar:

**MEDIUM**
- Anular ventas: hoy el cajero puede anular cualquier venta de la caja abierta (`sales.ts`, `sales.test.ts:345`), pero D4 dice "admin/owner". Decidir con el dueño: restringir a owner/admin o solo ventas propias en los últimos N minutos, y actualizar D4.
- Sin rate limiting en POS/gastos/imports (solo login lo tiene): agregar `POS_LIMITER` (≈120/min por usuario) en `wrangler.toml` y el guard de producción.
- `bodyLimit` solo en `/imports`: ponerlo también en `/sales`, `/cash-sessions`, `/expenses`, `/expense-categories` (≈64 KB).
- Doble conteo posible de ingresos si se reimporta HomeBank en días que ya tienen caja `pos` (`homebank-import.ts`): omitir ingresos de días con sesión `source='pos'`.
- Arqueo no a ciegas para el cajero (`CashReconciliation` y `expectedCashCents` visibles al contar) y efectivo esperado recortado a 0 (`session-summary.ts`; el CHECK de la tabla lo exige).
- Migración 0009 (`DROP TABLE users` con respaldo `_bk_*`): probarla en una D1 de staging y tomar `wrangler d1 time-travel info`/export antes de aplicarla en remoto.
- Canal `pos`: `useMenuItems` no pide `channel=all` (un producto solo-mostrador no aparece en el admin) y `MenuItemFormPage` no tiene selector Ambos/Web/Mostrador; el texto de `PosCatalogPanel` ya lo promete.
- Funciones de más de 50 líneas en el CMS: `useHomebankImport` (~196), `ExpensesPage` (~165), `CategoryCombobox` (~135), `ExpenseQuickForm` (~120), `PosWorkspace` (~104), `CloseRegisterFlow` (~73), `PaymentForm` (~68).

**LOW**
- `linesFromOrder` no aplica la ventana de 7 días de `/pending-web-orders`; un reintento con el mismo `clientUuid` y otro contenido devuelve la venta guardada sin avisar (409); `authenticate()` sin chequeo de rol en `categories`, `menu-items` y `rewards` (el cajero ve borradores/inactivos).
- `q` de gastos: el patrón LIKE de D1 (50 bytes) puede dar 500 con 13+ emojis; usar `instr(lower(...), lower(?))`.
- `INSERT OR IGNORE` en importaciones cuenta como "duplicado" una fila rechazada por CHECK; usar `ON CONFLICT … DO NOTHING`. Crear 500 categorías distintas en un commit no es atómico.
- Anular libera `order_id` y se pierde el vínculo auditable; `/pending-web-orders` expone teléfono al cajero; el sufijo `#n` del hash de filas repetidas depende del orden del archivo.
- `refreshClosedSessionSnapshot` tras anular/editar gasto: si falla, el cliente ve 500 con el cambio ya aplicado.
- La lista de ventas del turno se corta en 100 sin paginar; constante `'efectivo'` duplicada (CMS, API y script Aronium; `DEFAULT_PAYMENT_METHOD` del script difiere del de shared); `ownerOnlyChange` en `expenses.ts` tiene nombre invertido; `scripts/aronium/sql.ts` sin `Number.isSafeInteger` en enteros interpolados.
- Probar "Compartir" (Web Share) en un iPhone/Android reales (pendiente desde F5).

## Registro de cambios

| Fecha | Fase(s) | Qué se hizo | Desvíos |
|---|---|---|---|
| 2026-11-22 | F0 | Plan aprobado; inspección de pos.db y .xhb | HomeBank se usa con totales diarios → importador acepta .xhb y convierte ingresos en ventas resumen |
| 2026-11-22 | F1 | Sidebar `NAV_GROUPS`, rutas nuevas + redirects, `PosShell`, placeholders, `RequireRole` multi-rol | Etiquetas "Categorías de gastos"/"Categorías del menú"; guard de `cashier` en nav/rutas pendiente para F3 |
| 2026-11-22 | F2 | `0009_backoffice.sql`, money/localDate/backoffice en shared, `cashier` en `ROLES` | Rebuild de `users` con respaldo `_bk_*` de tablas hijas (FK CASCADE/RESTRICT); CHECKs extra de totales; `formatPEN` = formato es-PE existente ("S/ 1,234.50"); `localDayRangeUtc` semiabierto |
| 2026-11-22 | F3 | `/api/cash-sessions`, `/api/sales`, `/api/payment-methods`; filtro `channel` en menú/colecciones públicas (`?channel=web\|pos\|all`, pos/all exigen sesión); `menu_items.channel` editable por API; guard del cajero en CMS (`homePathForRole`); 54 tests nuevos | Con `orderId` se ignoran los `items` del cliente; `pending-web-orders` solo últimos 7 días; anular libera `order_id`; `expected_cash` recortado a 0 (CHECK de la tabla); cajero limitado a la caja abierta |
| 2026-11-22 | F6 | `/api/expenses` (CRUD, filtros from/to/categoría/método/q, paginado, total del filtro y total diario) y `/api/expense-categories` (árbol 2 niveles con conteo, no borra con gastos/hijas → 409); UI `ExpensesPage` (registro rápido: monto grande, chips de categorías más usadas, Enter guarda y vuelve al monto) y `ExpenseCategoriesPage`. Correcciones F3: descuento solo owner/admin (cajero 403); anular venta de caja cerrada recalcula `close_snapshot_json` + `expected_cash_cents` (`lib/session-refresh.ts`, `counted_cash_cents` intacto). 60 tests nuevos | `paid_from_register` exige método efectivo (400); filtrar por categoría padre incluye sus hijas; editar monto/borrar un gasto de caja ya cerrada: solo owner y recalcula el snapshot (misma lib); alta y "marcar de caja" atómicos contra el cierre; borrar categoría con gastos (aun eliminados) → 409 por FK RESTRICT; **0009 editada en sitio**: el CHECK de color GLOB superaba el límite de 50 bytes de patrón de D1 (rompía todo INSERT con color) → si ya aplicaste 0009 en tu D1 local, recréala (`wrangler d1 ... --local` reset); el POS (F4) debe ocultar el descuento al cajero |
| 2026-11-22 | F5 | `/ventas/cierres`: arqueo (contador por denominación PEN o monto directo, esperado vs contado vs diferencia con icono+texto, notas, diálogo de confirmación) → `POST /close` → **Resumen del día** con tarjeta ticket-Z 1080×1350 (logo, total, ventas, ticket promedio, barras por método de pago, top 5, gastos de caja, esperado/contado/diferencia, anuladas) generada en cliente con `html-to-image` (`pixelRatio` 2, pre-generada al montar) y acciones Compartir (Web Share con `files`) / Descargar PNG / Copiar resumen en texto; historial paginado para owner/admin con badge "Importado" y regenerar imagen desde `close_snapshot_json` (`?id=` deep-link). Cajero: accede a `/ventas/cierres` solo para cerrar su caja y ver el resumen; `GET /cash-sessions/:id` le permite leer la caja que él mismo cerró en las últimas 12 h (resto 403, con tests). `PosShell`: "Salir" va a `homePathForRole` (owner/admin) y el cajero tiene "Cerrar sesión" con confirmación. `/menu-items/sections` sin el tope de 24 para `channel=pos|all` (hasta 200; la web pública conserva 24, con test); el POS pide 200. | Logo copiado en línea (SVG) dentro de la tarjeta para que la captura no dependa de una `<img>` externa; el conteo en modo billetes exige contar algo o confirmar "S/ 0.00" (no hay cierre con 0 implícito); sin tests unitarios de UI (el CMS no tiene runner); reintento de captura si el PNG sale casi vacío (Safari); pendiente probar Compartir en un iPhone/Android real |
| 2026-11-22 | F7 | Parser puro `shared/homebank` (`.xhb`/`.csv`, `classifyRows`, `importHashes`, `prepareHomebankImport`/`chunkHomebankImport`) + esquemas Zod del contrato (`importSchemas.ts`); API `POST /api/imports/homebank/preview` y `/commit` (solo owner, lotes de 500 filas, `bodyLimit` 1 MB); UI `ExpenseImportPage` en 4 pasos (archivo con drag&drop y selector DD/MM·MM/DD, resumen, mapeo de categorías, importación por lotes con progreso/reintento/detener). Smoke local con el `.xhb` real: 577 gastos (S/ 263,092.76) y 519 ingresos (S/ 400,868.00), 0 errores; 2.º commit = 0 nuevos. 8 tests de `prepare` + 61 de integración (idempotencia, 401/403 anónimo-admin-cajero, validación, compras idénticas) | El cliente parsea y la API revalida todo con Zod; escribe con `json_each` en un solo statement (sin tope de variables de D1) y `INSERT OR IGNORE` por `import_hash`/`legacy_ref`; ingresos → una `cash_sessions` cerrada `source='homebank'` (`homebank:day:<fecha>`, 00:00–23:59 Lima) por día, nunca la sesión `pos`, y una `sale` por fila fechada a las 12:00 Lima (F9: las ventas `source='homebank'` no tienen hora real, excluirlas de ventas-por-hora); fechas aceptadas solo 2000–2100; un hash que ya existe como gasto eliminado cuenta como duplicado (no resucita); `/gastos/importar` está en el nav para admin pero la API es solo owner → la página avisa a no-owners; el CSV con fechas ambiguas pide DD/MM o MM/DD; categorías `Padre:Hija` se crean con su padre (reutiliza por nombre sin distinguir mayúsculas) |
| 2026-11-22 | F9 | API `reports-business.ts` (owner/admin, cajero 403): `/reports/summary` (+ período anterior de igual largo y deltas %), `/timeseries?granularity=day|week|month` (buckets sin huecos, semana = lunes), `/top-products` (por cantidad e importe), `/sales-by-hour`, `/sales-by-weekday`, `/expenses-by-category` (hijas sumadas en su padre), `/sales-by-payment`; todos con `from`/`to` en días locales de Lima (sin parámetros = mes en curso; máx. 3 660 días). Lógica pura en `lib/report-range|aggregate|queries.ts`; tipos en `shared/reports.ts`, períodos rápidos y `addLocalDays` en `shared`. UI `DashboardPage` + `components/dashboard/*`: selector de período en la URL (Hoy, 7 días, Este mes, Mes pasado, Este año, Personalizado), KPIs con delta (flecha + texto), ingresos vs egresos (SVG propio, tooltip por puntero y teclado), top 10 productos, ventas por hora y día de semana, egresos por categoría, ventas por método de pago, y debajo los pedidos web por aceptar (extraídos a `PendingOrdersSection`). Tests: 28 de integración (borde 23:30 Lima = otro día UTC, anuladas, HomeBank, borrados) + matriz de `pos-access` + unitarios de rangos/períodos | No hizo falta migración `0010`: `idx_sales_created` y `idx_expenses_date` ya existen en 0009; **ticket promedio y # ventas excluyen `source='homebank'`** (una venta resumen por día no es un ticket) pero los ingresos sí la incluyen y la UI lo avisa; hora, día de semana, método de pago y productos también excluyen HomeBank (su método es un `efectivo` por defecto, no real) y la respuesta trae `excludedSummaryCents` para la nota; gráficos en SVG/HTML propio en vez de `recharts` (0 KB extra, 4 formas simples, control total de tokens y accesibilidad: tabla `sr-only`, foco/teclado, leyenda + línea punteada, no solo color); paleta ingresos `#2a4fc0` / egresos `#cf142b` validada con `validate_palette`; el CMS no tiene modo oscuro, así que no hay variante; "Hoy" dibuja un solo punto por serie |
| 2026-11-22 | D15 | Método de pago opcional (API: `yape` si falta; UI sin preselección, botones de alternancia, "Cobrar (Yape)" + ayuda; también en "Cobrar pedido web") y cierre de caja con check "Cuadrar caja (contar efectivo)" desmarcado por defecto: `lib/session-snapshot.ts` (snapshot cuadrado/sin cuadrar), `session-refresh` mantiene `reconciled: false`, tipo `CashCloseSnapshot` = unión retrocompatible (`isReconciledSnapshot`, `hasExpectedCash`); UI de cierres oculta el contador, tarjeta/texto muestran "Caja no cuadrada" (gastos de caja y anuladas siguen) y el historial el badge "Sin cuadrar". Tests: shared + 8 de API | Sin migración `0010`: ningún CHECK de 0009 impide NULL en `counted/expected_cash_cents`; los tests de cierre existentes pasaron a `reconcile: true`; `countedCashCents` sin cuadrar se rechaza (400) en vez de ignorarse, para no perder un conteo en silencio; `CashSessionDetail.summary` de una caja cerrada sin cuadrar no trae `expectedCashCents`; sin tests de UI (el CMS no tiene runner) |
| 2026-11-22 | F10 | 6 tests E2E Playwright (escritorio + móvil): flujo dueño completo, cierre sin cuadrar, restricciones cajero, importación HomeBank idempotente, dashboard KPIs, POS móvil 390 px. Infraestructura aislada (API 8791, CMS 5193, base `.state/`). Corregidos: `cwd` en webServer, label contraseña regex, `listedExpense` con `listitem`. README + Makefile actualizados. | F8 (Aronium) sigue bloqueada esperando backup real |
| 2026-11-22 | F10 (cierre) | Verificación final: E2E 6/6 (2 corridas), criterios globales marcados con evidencia, revisión de seguridad y de código (0 CRITICAL/HIGH), carrito del POS se vacía al cerrar sesión, fixture sintético `homebank-demo.xhb` des-ignorado en `.gitignore`, sección "Pendientes post-F10" | El fixture estaba ignorado por `*.xhb` (no estaba en el commit 818cec7); F8 sigue ⛔ esperando el backup real de Aronium |
| 2026-11-22 | F6+ | Mejoras de Gastos pedidas por el dueño: (1) monto con expresiones tipo HomeBank (`evaluateAmountExpression` en `shared`, parser recursivo sin `eval`, 31 tests; `AmountInput` muestra `= S/ 35.00` en vivo, colapsa al total con Enter/blur y tiene botón "+" para el teclado del celular); (2) tipo de gasto libre: `CategoryCombobox` (combobox ARIA + Radix Popover) con opción "Usar «X» como nuevo tipo" que crea la categoría y luego el gasto (reutiliza la existente ignorando mayúsculas/acentos, reactiva una desactivada, resuelve 409) y campo "Detalle"; (3) "Compartir imagen": `GET /api/expenses/summary` (mismos filtros que el listado + `limit`) y tarjeta PNG 1080×1350 con total, barras por categoría (top 4 + "Otras") y 12 gastos + "+N más"; compartir / descargar / copiar texto reutilizando `closureShare`, `useClosureImage` y `BrandLogo` sin tocar `closures/` | El filtro por defecto de `/gastos` pasa de "Este mes" a "Hoy" (Lima); sin cambios en `expense-categories.ts` (ya rechazaba duplicados NOCASE); tipos y helpers de texto en `shared/expenseSummary.ts` (2 líneas en `index.ts`); "Nota" pasa a llamarse "Detalle" en UI |
| 2026-11-22 | F7/F8 | Backup real de Aronium recibido (`pos.db` en la raíz del proyecto, fuera de git). Análisis de solapamiento con HomeBank → D16: ventas solo de Aronium, HomeBank solo egresos; casilla de ingresos desmarcada por defecto, E2E (d) ajustado. | La importación real de Aronium sigue pendiente de ejecutarse (primero en copia aislada) |
| 2026-11-22 | F8 | Importación real de Aronium validada y aplicada a la D1 **local**: `scripts/aronium` (`inspect`/`map`/`build`) con el `pos.db` real → 9 272 ventas, 773 sesiones (780 cierres Z, 7 sin documentos), 15 052 líneas, total 52 783 940 céntimos (S/ 527 839,40), 0 violaciones de CHECK/FK, idempotente (2 pasadas, también contra D1 local aislada con `wrangler --persist-to`). 771 líneas fraccionarias como `quantity=1` con sufijo `(×0,5)`; pagos Debit Card→`tarjeta`, Voucher→`transferencia`; bordes de medianoche Lima correctos (23:40 Lima = 04:40 UTC del día siguiente). SQL listo para producción en `legacy-import/prod/` (92 lotes + `verify.sql`, `relink-items.sql`, `rollback-aronium.sql`) | Productos enlazados por **slug** (`item_slug` en el CSV; ids barajados validados) y nombre de línea unificado = `menu_items.name_es` actual (no emparejados: nombre legacy limpio); 63 de 88 productos `auto`, 25 sin emparejar (6 740 líneas, S/ 305 343,50, sobre todo las Promos) pendientes de que el dueño complete `item_slug`; `relink-items.sql` los asigna después sin duplicar; la D1 local ya tenía 519 ventas `homebank` (S/ 400 868,00, del smoke de F7) que duplican ingresos frente a D16; remoto NO ejecutado (checklist en `scripts/aronium/README.md`) |
