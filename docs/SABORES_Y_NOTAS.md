# Sabores y notas por línea (POS)

Lógica pura y compartida: `packages/shared/src/flavors.ts` (`priceFlavoredLine`). La API la usa para
tasar al registrar la venta o guardar una cuenta de mesa (fuente de verdad); el CMS, para el precio en
vivo sin red. Dinero en céntimos enteros.

## Cómo están modeladas las promos

Las promos son ítems normales de la categoría `promos` (`has_sizes = 0`) con precio único. Antes no
tenían componentes estructurados (las pizzas incluidas solo estaban en la descripción). La migración
`0011_line_flavors_notes.sql` agrega `menu_items.promo_pizza_count` y `menu_items.promo_pizza_size_id`
(editables en Menú > ítem) y configura por slug las 4 promos de la carta:

| Promo | Precio | Pizzas | Tamaño |
|---|---|---|---|
| Promo Pizza Grande | S/ 41 | 1 | Grande |
| Promo Pizza Familiar | S/ 51 | 1 | Familiar |
| Promo de Fin de Semana | S/ 60 | 2 | Mediana |
| Promo 2 Pizzas Grandes | S/ 80 | 2 | Grande |

## Reglas de precio

| Caso | Regla |
|---|---|
| Pizza individual, 1 sabor | Precio de esa pizza en su tamaño. |
| Pizza individual, 2 sabores | Precio del sabor **más caro en el mismo tamaño** (empate: el primero). |
| Promo, todas Clásicas | Precio normal de la promo. |
| Promo, pizza de otra categoría | + (precio de lista de su categoría − precio de lista de Clásicas) en el tamaño de la promo. |
| Promo, pizza de 2 sabores | Primero el sabor más caro; el adicional es el **mayor** entre los sabores de esa pizza. |
| Categoría más barata que Clásicas | Adicional 0 (la promo nunca baja de su precio). |

El adicional NO está fijo en código: se deriva de `category_prices`. Con la carta actual
(Clásicas 25/35/45, Especiales 27/37/47, Gourmet 29/39/49, Carnívoras 31/41/51, De la Casa 33/43/53)
da +2, +4, +6 y +8 en cualquier tamaño. Clásicas se identifica por slug `clasicas`; si no existe o no
tiene precio en el tamaño, la promo con sabores se rechaza (no se adivina).

Ejemplos:

- Pizza Grande Hawaiana + Llanera → S/ 43.00 (precio de Llanera Grande).
- Promo 2 Grandes: Hawaiana | Pepperoni → S/ 80.00.
- Promo 2 Grandes: Araguaney | Hawaiana/Llanera → 80 + 2 + 8 = S/ 90.00.
- Promo Fin de Semana (Medianas): Alborada | Golosa → 60 + 4 + 2 = S/ 66.00.

## Supuestos (conservadores)

- Máximo de sabores por pizza: `MAX_FLAVORS_PER_PIZZA = 2` (constante en `flavors.ts`), igual en pizza y promo.
- En promos se puede elegir cualquier pizza activa del mostrador (no solo las que nombra la descripción);
  las no Clásicas pagan su adicional.
- Si una pizza tiene sobreprecio propio (`item_prices`), el "más caro" usa el precio real del ítem y el
  adicional de promo usa el precio de **lista de la categoría** (el mayor entre los sabores).
- Promo sin sabores elegidos: se cobra el precio normal (compatibilidad); el ticket avisa "Falta elegir los sabores".
- La nota: máx. 200 caracteres, sin caracteres de control/bidi, espacios colapsados. Se pinta siempre como texto (escapado).

## Persistencia

`sale_items.flavors_json` / `sale_items.note` y lo mismo en `dining_tab_items` (columnas NULL en lo
histórico). `flavors_json` guarda el snapshot ya tasado (sabores, sabor que fija el precio, categoría y
adicional) para que el ticket sea auditable aunque cambie el menú.

## Ticket

`ticketDetailLines()` genera el detalle bajo cada línea y `wrapTicketText()` lo ajusta a 32 (58 mm) o
48 (80 mm) columnas:

```
1 x Promo 2 Pizzas Grandes     S/ 90.00
   Pizza 1: Araguaney
   Adicional Pizzas Especiales +S/ 2.00
   Pizza 2: Hawaiana / Llanera
   Adicional Pizzas de la Casa +S/ 8.00
   Nota: sin cebolla
```
