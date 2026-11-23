# Importador de Aronium (F8)

Pasa el historial de ventas de Aronium (`pos.db`) a las tablas del back-office
(`cash_sessions`, `sales`, `sale_items`, `legacy_product_map`). Todo corre en tu
máquina con Node 24 (`node:sqlite`); el `pos.db` se abre **solo lectura**.

Ventas = solo Aronium (decisión D16 del plan): HomeBank aporta únicamente los gastos.
Con el backup real (`pos.db` en la raíz del proyecto, fuera de git) salen 9 272 ventas,
780 cierres Z (773 con ventas), 15 052 líneas y S/ 527 839,40 (52 783 940 céntimos).

La salida va a `legacy-import/` en la raíz del repo (ignorada por git). Los comandos se
corren desde `apps/api`. Para producción usa **`legacy-import/prod/`**: el SQL enlaza cada
producto por **slug** (`menu_items.slug`), no por id, así que sirve aunque los ids del menú
sean distintos en local y en producción.

## Flujo

1. **Inspeccionar** el archivo (conteos, fechas, totales, cierres Z):

   ```bash
   pnpm import-aronium inspect ../../../pos.db
   ```

2. **Exportar el menú** de la base destino (consulta de solo lectura) a un `menu.json` con
   la forma `[{ "id": 11, "nameEs": "Americana", "categorySlug": "clasicas", "slug": "americana" }, ...]`:

   ```bash
   pnpm wrangler d1 execute sabor-llanero --local --json --command "SELECT mi.id AS id, mi.name_es AS nameEs, c.slug AS categorySlug, mi.slug AS slug FROM menu_items mi JOIN categories c ON c.id = mi.category_id ORDER BY mi.id"
   ```

   Guarda el arreglo `results` del JSON como `menu.json`.

3. **Generar el mapa de productos** (no pisa nada fuera de `--out`):

   ```bash
   pnpm import-aronium map ../../../pos.db --menu ruta/menu.json --out ../../legacy-import/prod
   ```

   Crea `product-map.csv` con `item_id` e `item_slug`. Solo empareja por nombre exacto (sin
   acentos ni mayúsculas); ante la duda queda `status=unmatched`.

4. **Editar el CSV a mano** (Excel o similar; acepta `,` o `;`). Para asignar un producto
   pendiente completa **`item_slug`** (el que manda). Si solo llenas `item_id`, pasa el menú al
   `build` con `--menu` y el slug se completa solo. `size_key` puede ser `mediana`, `grande`,
   `familiar` o vacío. Lo que dejes sin ítem se importa igual (con su nombre original
   limpio); solo no cuenta en reportes por producto.

5. **Generar los lotes SQL:**

   ```bash
   pnpm import-aronium build ../../../pos.db --map ../../legacy-import/prod/product-map.csv --menu ruta/menu.json --out ../../legacy-import/prod
   # opcional: --from 2026-01-01  (solo ventas desde esa fecha, día de Lima)
   ```

   Escribe `aronium-001.sql`, `aronium-002.sql`, ... (menos de 400 sentencias y ~90 KB cada
   uno), `verify.sql`, `relink-items.sql` y `rollback-aronium.sql`. Imprime el total esperado
   en céntimos, ventas y líneas, y avisa si algún slug del CSV no existe en el menú.

6. **Aplicar en local** (la D1 local debe tener migraciones y `seed.sql`). En bash:

   ```bash
   for f in ../../legacy-import/prod/aronium-*.sql; do pnpm wrangler d1 execute sabor-llanero --local --file="$f" || break; done
   pnpm wrangler d1 execute sabor-llanero --local --file=../../legacy-import/prod/verify.sql
   ```

   En PowerShell:

   ```powershell
   foreach ($f in Get-ChildItem ..\..\legacy-import\prod\aronium-*.sql) { pnpm wrangler d1 execute sabor-llanero --local --file=$f.FullName; if ($LASTEXITCODE) { break } }
   pnpm wrangler d1 execute sabor-llanero --local --file=..\..\legacy-import\prod\verify.sql
   ```

   Compara cada resultado de `verify.sql` con su comentario `esperado`. Es seguro repetirlo:
   las filas llevan `legacy_ref` único y las líneas solo se insertan si la venta no tiene.

7. **Asignar productos después de importar.** Corrige el CSV y vuelve a correr `build`; luego
   aplica solo `relink-items.sql` (UPDATE por nombre/ítem/tamaño, no toca importes ni
   duplica, se puede repetir):

   ```bash
   pnpm wrangler d1 execute sabor-llanero --local --file=../../legacy-import/prod/relink-items.sql
   ```

## Nombres de las líneas

- Producto emparejado: `sale_items.name` = `menu_items.name_es` **actual** del ítem (resuelto
  en el SQL con `COALESCE`; si el slug no existe en el destino, cae al nombre de Aronium).
- Producto sin emparejar: nombre de Aronium limpio (bytes rotos tipo `Champi�on` reparados con
  un mapa de palabras conocidas, espacios colapsados y primera letra en mayúscula). Los nombres
  que no se pueden reparar con certeza se dejan tal cual, nunca se adivinan.
- Líneas fraccionarias: el sufijo va después del nombre resuelto (`Tequeños (×0,5)`).
- `size_label` sale de la clave de tamaño del CSV (`Mediana`, `Grande`, `Familiar`).
- Los nombres del menú de las pizzas no incluyen el tamaño (va en `size_label`). Ojo: en
  bebidas y promos el tamaño sí es parte del nombre (`Gaseosa (1 litro)`, `Promo Pizza Grande`).

## Checklist de producción

Nada de esto se ejecuta sin el OK explícito del dueño. Todos los comandos desde `apps/api`.

1. **Respaldo previo** de la D1 de producción (lectura):

   ```bash
   pnpm wrangler d1 export sabor-llanero --env production --remote --output=../../legacy-import/backup-prod-AAAA-MM-DD.sql
   ```

2. **Migración 0009 en remoto.** Revisa qué falta:
   `pnpm wrangler d1 migrations list sabor-llanero --env production --remote`. La 0009 reconstruye
   `users` (con respaldo `_bk_*` de tablas hijas), así que antes pruébala sobre una copia: carga el
   export del paso 1 en una persistencia local aparte (`--persist-to`) y aplica ahí las migraciones;
   revisa que no se pierdan usuarios, tokens de reset ni auditoría de pedidos/canjes.
3. **Desplegar API y CMS** con tu flujo habitual (el script `deploy` de `apps/api` aplica las
   migraciones pendientes y despliega el Worker). Comprueba que el login y `/api/payment-methods`
   respondan antes de importar.
4. **Mapa contra el menú de producción**, con una consulta de solo lectura (paso 2 del flujo, pero con
   `--env production --remote`). Genera `menu.json`, corre `build --menu` y confirma que no hay avisos
   de slugs inexistentes. Si los slugs coinciden con local, el CSV ya revisado sirve tal cual.
5. **Aplicar los lotes** (92 archivos; es lo único que escribe en producción):

   ```bash
   for f in ../../legacy-import/prod/aronium-*.sql; do pnpm wrangler d1 execute sabor-llanero --env production --remote --file="$f" || break; done
   ```

   Si se corta, repite el mismo comando: lo ya importado se omite. Tiempo estimado: unos 10 a 30
   minutos (cada archivo tarda de 5 a 20 s según la red). Límites de D1 a tener en cuenta: el SQL
   máximo por sentencia es 100 KB (los lotes quedan muy por debajo), y en el plan gratuito hay un tope de
   100 000 filas escritas por día, **índices incluidos**; esta importación escribe unas 25 000 filas más
   sus índices, así que puede acercarse al tope. Revisa tu plan; si sobra poco, importa por tramos
   (`--from`/archivos) en días distintos.
6. **Verificar** en remoto:

   ```bash
   pnpm wrangler d1 execute sabor-llanero --env production --remote --file=../../legacy-import/prod/verify.sql
   ```

   Debe dar **9 272 ventas** y `total_cents` **52 783 940** (S/ 527 839,40), **773 sesiones**,
   **15 052 líneas** y 0 en las dos filas `descuadradas`. Pagos: 9 269 efectivo, 1 tarjeta, 2 transferencia.
7. **Revertir** si algo no cuadra: `rollback-aronium.sql` borra solo lo importado (`source='aronium'`) y
   deja intactas las ventas del POS y de HomeBank:

   ```bash
   pnpm wrangler d1 execute sabor-llanero --env production --remote --file=../../legacy-import/prod/rollback-aronium.sql
   ```

   Como último recurso, restaura desde el export del paso 1.

## Cómo se transforma

- Una sesión de caja cerrada por cada cierre Z con ventas (`aronium:z:<id>`). Los documentos
  fuera de todo cierre van a una sesión sintética por día local (`aronium:day:<fecha>`).
- Horas: Aronium guarda hora de Lima; en la base va en UTC (+5 h). Una venta de las 23:40 en
  Lima queda con fecha UTC del día siguiente y se sigue mostrando en su día de Lima.
- Efectivo esperado = efectivo contado = suma de las ventas en efectivo; apertura 0.
- Pagos: Cash → `efectivo`; Credit/Debit Card → `tarjeta`; Check, Voucher, Gift Card
  → `transferencia`. Sin pago o tipo desconocido → `efectivo` (queda una advertencia).
- Cantidades fraccionarias (media porción): `quantity = 1` y el precio unitario es el total
  de la línea. Los totales no cambian.
- Líneas de S/ 0 y documentos sin líneas se omiten y se listan como advertencias.
- `created_by` y `opened_by` quedan en NULL.

## Tests

```bash
pnpm test:aronium
```

Usan su propia config (entorno Node) y el sufijo `.script-test.ts`, así que `pnpm test`
(pool de workers) no los ejecuta.
