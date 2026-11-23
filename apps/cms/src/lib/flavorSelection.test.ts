import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { priceFlavoredLine, type MenuItemWithPrices } from '@sabor/shared';
import { addLine, changeQuantity, lineKeyOf, toSaleItems, updateLineDetails, type CartLine } from './posCart';
import { savedQuantities, tabToCartLines } from './tableTab';
import { buildCatalog, flavorCatalogOf, flavorTargetOf, priceLookup, type CategoryWithPrices, type PosMenuSection } from './posCatalog';
import {
  flavorGroups,
  initialSelection,
  livePrice,
  nextActivePizza,
  removeFlavor,
  searchFlavors,
  toggleFlavor,
} from './flavorSelection';

const GRANDE = 2;
const SIZES = [{ id: GRANDE, key: 'grande', labelEs: 'Grande', labelEn: 'Large', detailEs: '', detailEn: '', displayOrder: 1 }];

function category(id: number, slug: string, nameEs: string, hasSizes: boolean, grande?: number): CategoryWithPrices {
  return {
    id,
    slug,
    nameEs,
    nameEn: '',
    hasSizes,
    displayOrder: id,
    bannerImageKey: null,
    isActive: true,
    createdAt: '',
    prices: grande === undefined ? [] : [{ id, categoryId: id, sizeId: GRANDE, price: grande }],
  };
}

function item(id: number, nameEs: string, categoryId: number, opts: { grande?: number; price?: number; promo?: number } = {}): MenuItemWithPrices {
  return {
    id,
    categoryId,
    slug: `i-${id}`,
    nameEs,
    nameEn: '',
    descriptionEs: '',
    descriptionEn: '',
    price: opts.price ?? null,
    channel: 'both',
    isFeatured: false,
    isActive: true,
    displayOrder: 0,
    createdAt: '',
    updatedAt: '',
    promoPizzaCount: opts.promo ?? null,
    promoPizzaSizeId: opts.promo ? GRANDE : null,
    prices: opts.grande === undefined ? [] : [{ sizeId: GRANDE, sizeKey: 'grande', price: opts.grande, isOverride: false }],
    coverImageKey: null,
  };
}

const CATS = [
  category(1, 'clasicas', 'Pizzas Clásicas', true, 35),
  category(2, 'especiales', 'Pizzas Especiales', true, 37),
  category(3, 'de-la-casa', 'Pizzas de la Casa', true, 43),
  category(4, 'promos', 'Promociones', false),
];
const SECTIONS: PosMenuSection[] = [
  { category: CATS[0]!, items: [item(10, 'Hawaiana', 1, { grande: 35 }), item(11, 'Pepperoni', 1, { grande: 35 })] },
  { category: CATS[1]!, items: [item(20, 'Araguaney', 2, { grande: 37 })] },
  { category: CATS[2]!, items: [item(30, 'Llanera', 3, { grande: 43 })] },
  { category: CATS[3]!, items: [item(40, 'Promo 2 Grandes', 4, { price: 80, promo: 2 })] },
];
const catalog = buildCatalog(SECTIONS, SIZES, CATS);
const hawaiana = catalog.products.find((p) => p.id === 10)!;
const promo = catalog.products.find((p) => p.id === 40)!;

describe('catálogo del POS con sabores', () => {
  it('marca pizzas y promos configuradas', () => {
    assert.equal(hawaiana.isPizza, true);
    assert.deepEqual(promo.promo, { pizzaCount: 2, sizeId: GRANDE, sizeLabel: 'Grande' });
    assert.deepEqual(flavorTargetOf(promo, null), { kind: 'promo', itemId: 40, basePriceCents: 8000, pizzaCount: 2, sizeId: GRANDE });
  });

  it('agrupa sabores por categoría con el adicional del tamaño', () => {
    const groups = flavorGroups(flavorCatalogOf(catalog), catalog.categories, GRANDE);
    assert.deepEqual(
      groups.map((g) => [g.category.name, g.options.map((o) => `${o.name}+${o.surchargeCents}`)]),
      [
        ['Pizzas Clásicas', ['Hawaiana+0', 'Pepperoni+0']],
        ['Pizzas Especiales', ['Araguaney+200']],
        ['Pizzas de la Casa', ['Llanera+800']],
      ],
    );
    assert.deepEqual(searchFlavors(groups, 'llan').map((o) => o.name), ['Llanera']);
  });
});

describe('selección de sabores', () => {
  const pizzaTarget = flavorTargetOf(hawaiana, GRANDE)!;
  const promoTarget = flavorTargetOf(promo, null)!;

  it('pizza: arranca con su sabor fijo, agrega, reemplaza el segundo y no quita el fijo', () => {
    let sel = initialSelection(pizzaTarget, null);
    assert.deepEqual(sel, [[10]]);
    sel = toggleFlavor(sel, 0, 30, 10);
    assert.deepEqual(sel, [[10, 30]]);
    sel = toggleFlavor(sel, 0, 20, 10);
    assert.deepEqual(sel, [[10, 20]]);
    assert.deepEqual(removeFlavor(sel, 0, 10, 10), [[10, 20]]);
    assert.deepEqual(toggleFlavor(sel, 0, 20, 10), [[10]]);
  });

  it('promo: avanza a la pizza vacía y explica el precio en vivo', () => {
    let sel = initialSelection(promoTarget, null);
    const incomplete = livePrice(promoTarget, sel, flavorCatalogOf(catalog));
    assert.equal(incomplete.ok, false);
    sel = toggleFlavor(sel, 0, 20, null);
    assert.equal(nextActivePizza(sel, 0), 1);
    sel = toggleFlavor(sel, 1, 10, null);
    sel = toggleFlavor(sel, 1, 30, null);
    const price = livePrice(promoTarget, sel, flavorCatalogOf(catalog));
    assert.ok(price.ok);
    assert.equal(price.result.unitPriceCents, 8000 + 200 + 800);
    assert.equal(price.explanation.length, 3);
  });

  it('el precio en vivo del CMS es el mismo que tasa el servidor (misma función compartida)', () => {
    const sel = [[10, 30]];
    const live = livePrice(pizzaTarget, sel, flavorCatalogOf(catalog));
    assert.ok(live.ok);
    assert.equal(live.result.unitPriceCents, priceFlavoredLine(pizzaTarget, sel, flavorCatalogOf(catalog)).unitPriceCents);
    assert.equal(live.result.unitPriceCents, 4300);
  });
});

describe('ticket: líneas con sabores y notas', () => {
  const base = { itemId: 10, sizeId: GRANDE, name: 'Hawaiana', sizeLabel: 'Grande', unitPriceCents: 3500 };

  it('no fusiona líneas con distintos sabores o nota; la cantidad respeta la clave', () => {
    let lines: CartLine[] = addLine([], base);
    lines = addLine(lines, { ...base, note: 'sin cebolla' });
    lines = addLine(lines, { ...base, flavors: [[10, 30]], unitPriceCents: 4300 });
    lines = addLine(lines, { ...base, note: 'sin cebolla' });
    assert.equal(lines.length, 3);
    assert.deepEqual(lines.map((l) => l.quantity), [1, 2, 1]);
    lines = changeQuantity(lines, lines[2]!.key, 1);
    assert.deepEqual(lines.map((l) => l.quantity), [1, 2, 2]);
  });

  it('editar sabores/nota cambia la clave y fusiona si queda igual a otra línea', () => {
    let lines: CartLine[] = addLine(addLine([], base), { ...base, note: 'x' });
    lines = updateLineDetails(lines, lines[1]!.key, { note: null });
    assert.equal(lines.length, 1);
    assert.equal(lines[0]!.quantity, 2);
    lines = updateLineDetails(lines, lines[0]!.key, { flavors: [[10, 30]], unitPriceCents: 4300 });
    assert.equal(lines[0]!.key, lineKeyOf({ itemId: 10, sizeId: GRANDE, flavors: [[10, 30]], note: null }));
  });

  it('envía solo ids, sabores y nota al servidor (nunca precios)', () => {
    const lines = addLine([], { ...base, flavors: [[10, 30]], note: 'bien cocida', unitPriceCents: 4300 });
    assert.deepEqual(toSaleItems(lines), [{ itemId: 10, sizeId: GRANDE, quantity: 1, flavors: [[10, 30]], note: 'bien cocida' }]);
  });

  it('re-tasa sabores al restaurar y descarta sabores que ya no existen', () => {
    const lookup = priceLookup(catalog);
    const line = addLine([], { ...base, flavors: [[10, 30]], unitPriceCents: 1 })[0]!;
    assert.equal(lookup(10, GRANDE, line)?.unitPriceCents, 4300);
    assert.equal(lookup(10, GRANDE, { ...line, flavors: [[10, 999]] }), undefined);
  });
});

describe('cuenta de mesa con sabores y nota', () => {
  it('recarga la línea con sabores/nota y la misma clave que el ticket', () => {
    const pizzas = priceFlavoredLine({ kind: 'pizza', itemId: 10, sizeId: GRANDE }, [[10, 30]], flavorCatalogOf(catalog)).pizzas;
    const tab = {
      id: 1, tableId: 1, status: 'open', version: 1, openedAt: '', openedBy: null, updatedAt: '', saleId: null,
      totalCents: 4300, itemCount: 1,
      items: [{ id: 5, itemId: 10, sizeId: GRANDE, name: 'Hawaiana', sizeLabel: 'Grande', unitPriceCents: 4300, quantity: 1, lineTotalCents: 4300, flavors: { kind: 'pizza' as const, pizzas }, note: 'sin cebolla' }],
    } as unknown as Parameters<typeof tabToCartLines>[0];
    const [line] = tabToCartLines(tab);
    assert.deepEqual(line?.flavors, [[10, 30]]);
    assert.equal(line?.note, 'sin cebolla');
    assert.equal(line?.key, lineKeyOf({ itemId: 10, sizeId: GRANDE, flavors: [[10, 30]], note: 'sin cebolla' }));
    assert.equal(savedQuantities(tab).get(line!.key), 1);
  });
});
