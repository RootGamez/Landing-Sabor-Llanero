# Importador de Aronium (F8)

Pasa el historial de ventas de Aronium (`pos.db`) a las tablas del back-office
(`cash_sessions`, `sales`, `sale_items`, `legacy_product_map`). Todo corre en tu
máquina con Node 24 (`node:sqlite`); el `pos.db` se abre **solo lectura**.

> El `pos.db` de diseño NO es el backup real. Antes de importar a producción,
> pídele al dueño el backup actualizado de Aronium y vuelve a correr `inspect`.

La salida va a `legacy-import/` en la raíz del repo (ignorada por git). Todos los
comandos se corren desde `apps/api`.

## Flujo

1. **Inspeccionar** el archivo (conteos, fechas, totales, cierres Z):

   ```bash
   pnpm import-aronium inspect ruta/pos.db
   ```

2. **Generar el mapa de productos.** Necesitas un `menu.json` con el menú actual,
   una lista `[{ "id": 13, "nameEs": "Americana", "categorySlug": "clasicas" }, ...]`
   (los `id` son `menu_items.id` de la base donde vas a importar):

   ```bash
   pnpm import-aronium map ruta/pos.db --menu ruta/menu.json
   ```

   Crea `legacy-import/product-map.csv`. Los productos que no se pudieron emparejar
   por nombre quedan con `status=unmatched`.

3. **Editar el CSV a mano** (Excel o similar; acepta `,` o `;`). Completa `item_id`
   en las filas que falten. `size_key` puede ser `mediana`, `grande`, `familiar` o
   vacío. Lo que dejes sin `item_id` se importa igual: cada línea guarda el nombre
   original, así que el historial no se pierde.

4. **Generar los lotes SQL:**

   ```bash
   pnpm import-aronium build ruta/pos.db --map ../../legacy-import/product-map.csv
   # opcional: --from 2025-01-01  (solo ventas desde esa fecha, hora de Lima)
   ```

   Escribe `aronium-001.sql`, `aronium-002.sql`, ... (cada uno con menos de 400
   sentencias y unos 90 KB) y `verify.sql`. Al final imprime el total esperado en
   céntimos y la cantidad de ventas y líneas.

5. **Aplicar en local** y verificar (en orden, uno por uno):

   ```bash
   pnpm wrangler d1 execute sabor-llanero --local --file=../../legacy-import/aronium-001.sql
   # ... repite con cada archivo ...
   pnpm wrangler d1 execute sabor-llanero --local --file=../../legacy-import/verify.sql
   ```

   Compara cada resultado con el comentario `esperado` de `verify.sql`. El total
   debe coincidir al céntimo con el que imprimió `build`.

6. **Remoto**: solo con el OK explícito del dueño y con el backup actualizado de
   Aronium ya importado en local. Es el mismo comando con `--remote`
   (`--env production`). Es seguro repetirlo: las filas llevan `legacy_ref` único y
   no se duplican.

## Cómo se transforma

- Una sesión de caja cerrada por cada cierre Z (`aronium:z:<id>`). Los documentos
  fuera de todo cierre van a una sesión sintética por día local (`aronium:day:<fecha>`).
- Horas: Aronium guarda hora de Lima; en la base va en UTC (+5 h).
- Efectivo esperado = efectivo contado = suma de las ventas en efectivo; apertura 0.
- Pagos: Cash → `efectivo`; Credit/Debit Card → `tarjeta`; Check, Voucher, Gift Card
  → `transferencia`. Sin pago o tipo desconocido → `efectivo` (queda una advertencia).
- Cantidades fraccionarias (media porción): `quantity = 1`, el precio unitario es el
  total de la línea y el nombre queda como `Tequeños (×0,5)`. Los totales no cambian.
- Líneas de S/ 0 y documentos sin líneas se omiten y se listan como advertencias.
- `created_by` y `opened_by` quedan en NULL.

## Tests

```bash
pnpm test:aronium
```

Usan su propia config (entorno Node) y el sufijo `.script-test.ts`, así que
`pnpm test` (pool de workers) no los ejecuta.
