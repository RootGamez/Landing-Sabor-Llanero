import { describe, expect, it } from 'vitest';
import {
  FlavorPricingError,
  MAX_FLAVORS_PER_PIZZA,
  buildFlavorCatalog,
  cartLineIdentity,
  normalizeLineNote,
  parseSaleItemFlavors,
  priceFlavoredLine,
  ticketDetailLines,
  wrapTicketText,
  type FlavorCategoryInfo,
  type FlavorItem,
  type FlavorPricingCatalog,
} from './flavors';

// Datos con la forma de la carta real (seed.sql): Clásicas 25/35/45,
// Especiales 27/37/47, Gourmet 29/39/49, De la Casa 33/43/53 (soles).
const MEDIANA = 1;
const GRANDE = 2;
const FAMILIAR = 3;

const CLASICAS = 10;
const ESPECIALES = 11;
const GOURMET = 12;
const CASA = 13;

const HAWAIANA = 100;
const PEPPERONI = 101;
const AMERICANA = 102;
const ARAGUANEY = 200;
const GOLOSA = 201;
const ALBORADA = 300;
const LLANERA = 400;
const INACTIVA = 999;

function prices(m: number, g: number, f: number): Record<number, number> {
  return { [MEDIANA]: m, [GRANDE]: g, [FAMILIAR]: f };
}

function category(id: number, name: string, list: Record<number, number>): [number, FlavorCategoryInfo] {
  return [id, { id, name, listPriceCentsBySize: list }];
}

function flavor(itemId: number, name: string, categoryId: number, list: Record<number, number>): [number, FlavorItem] {
  return [itemId, { itemId, name, categoryId, priceCentsBySize: list }];
}

const catalog: FlavorPricingCatalog = {
  baseCategoryId: CLASICAS,
  categories: new Map([
    category(CLASICAS, 'Pizzas Clásicas', prices(2500, 3500, 4500)),
    category(ESPECIALES, 'Pizzas Especiales', prices(2700, 3700, 4700)),
    category(GOURMET, 'Pizzas Gourmet', prices(2900, 3900, 4900)),
    category(CASA, 'Pizzas de la Casa', prices(3300, 4300, 5300)),
  ]),
  flavors: new Map([
    flavor(HAWAIANA, 'Hawaiana', CLASICAS, prices(2500, 3500, 4500)),
    flavor(PEPPERONI, 'Pepperoni', CLASICAS, prices(2500, 3500, 4500)),
    flavor(AMERICANA, 'Americana', CLASICAS, prices(2500, 3500, 4500)),
    flavor(ARAGUANEY, 'Araguaney', ESPECIALES, prices(2700, 3700, 4700)),
    flavor(GOLOSA, 'Golosa', ESPECIALES, prices(2700, 3700, 4700)),
    flavor(ALBORADA, 'Alborada', GOURMET, prices(2900, 3900, 4900)),
    // Llanera sin precio Mediana a propósito: valida "mismo tamaño".
    flavor(LLANERA, 'Llanera', CASA, { [GRANDE]: 4300, [FAMILIAR]: 5300 }),
  ]),
};

const PROMO_2_GRANDES = { kind: 'promo', itemId: 40, basePriceCents: 8000, pizzaCount: 2, sizeId: GRANDE } as const;
const PROMO_GRANDE = { kind: 'promo', itemId: 37, basePriceCents: 4100, pizzaCount: 1, sizeId: GRANDE } as const;

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(FlavorPricingError);
    expect((err as FlavorPricingError).code).toBe(code);
    return;
  }
  throw new Error(`se esperaba FlavorPricingError ${code}`);
}

describe('priceFlavoredLine · pizza individual', () => {
  it('1 sabor: cobra el precio de esa pizza en ese tamaño', () => {
    const result = priceFlavoredLine({ kind: 'pizza', itemId: HAWAIANA, sizeId: GRANDE }, [[HAWAIANA]], catalog);
    expect(result.unitPriceCents).toBe(3500);
    expect(result.pizzas).toEqual([
      {
        flavors: [{ itemId: HAWAIANA, name: 'Hawaiana' }],
        pricedBy: { itemId: HAWAIANA, name: 'Hawaiana' },
        categoryName: 'Pizzas Clásicas',
        surchargeCents: 0,
      },
    ]);
  });

  it('2 sabores del mismo precio: precio normal y manda el primero', () => {
    const result = priceFlavoredLine({ kind: 'pizza', itemId: HAWAIANA, sizeId: MEDIANA }, [[HAWAIANA, PEPPERONI]], catalog);
    expect(result.unitPriceCents).toBe(2500);
    expect(result.pizzas[0]?.pricedBy.name).toBe('Hawaiana');
  });

  it('Hawaiana + Llanera (Grande): se cobra el precio de Llanera Grande', () => {
    const result = priceFlavoredLine({ kind: 'pizza', itemId: HAWAIANA, sizeId: GRANDE }, [[HAWAIANA, LLANERA]], catalog);
    expect(result.unitPriceCents).toBe(4300);
    expect(result.pizzas[0]?.pricedBy).toEqual({ itemId: LLANERA, name: 'Llanera' });
    expect(result.pizzas[0]?.surchargeCents).toBe(0);
  });

  it('compara en el MISMO tamaño: Familiar usa los precios Familiar', () => {
    const result = priceFlavoredLine({ kind: 'pizza', itemId: HAWAIANA, sizeId: FAMILIAR }, [[HAWAIANA, ALBORADA]], catalog);
    expect(result.unitPriceCents).toBe(4900);
  });

  it('rechaza un sabor sin precio en ese tamaño (Llanera no tiene Mediana)', () => {
    expectCode(
      () => priceFlavoredLine({ kind: 'pizza', itemId: HAWAIANA, sizeId: MEDIANA }, [[HAWAIANA, LLANERA]], catalog),
      'no_price_for_size',
    );
  });

  it('rechaza sabores inexistentes o inactivos (no están en el catálogo)', () => {
    expectCode(
      () => priceFlavoredLine({ kind: 'pizza', itemId: HAWAIANA, sizeId: GRANDE }, [[HAWAIANA, INACTIVA]], catalog),
      'unknown_flavor',
    );
  });

  it(`rechaza más de ${MAX_FLAVORS_PER_PIZZA} sabores`, () => {
    expectCode(
      () =>
        priceFlavoredLine({ kind: 'pizza', itemId: HAWAIANA, sizeId: GRANDE }, [[HAWAIANA, PEPPERONI, AMERICANA]], catalog),
      'too_many_flavors',
    );
  });

  it('rechaza sabores repetidos, pizza vacía y más de una pizza', () => {
    const target = { kind: 'pizza', itemId: HAWAIANA, sizeId: GRANDE } as const;
    expectCode(() => priceFlavoredLine(target, [[HAWAIANA, HAWAIANA]], catalog), 'duplicate_flavor');
    expectCode(() => priceFlavoredLine(target, [[]], catalog), 'empty_pizza');
    expectCode(() => priceFlavoredLine(target, [[HAWAIANA], [PEPPERONI]], catalog), 'wrong_pizza_count');
  });

  it('la pizza del ticket debe ser uno de sus sabores', () => {
    expectCode(
      () => priceFlavoredLine({ kind: 'pizza', itemId: HAWAIANA, sizeId: GRANDE }, [[PEPPERONI, LLANERA]], catalog),
      'must_include_item',
    );
  });
});

describe('priceFlavoredLine · promociones', () => {
  it('todas Clásicas: precio normal de la promo', () => {
    const result = priceFlavoredLine(PROMO_2_GRANDES, [[HAWAIANA], [PEPPERONI]], catalog);
    expect(result.unitPriceCents).toBe(8000);
    expect(result.pizzas.map((p) => p.surchargeCents)).toEqual([0, 0]);
  });

  it('una Especial: + diferencia Especial − Clásica del tamaño (S/ 2)', () => {
    const result = priceFlavoredLine(PROMO_2_GRANDES, [[HAWAIANA], [ARAGUANEY]], catalog);
    expect(result.unitPriceCents).toBe(8200);
    expect(result.pizzas[1]).toMatchObject({ surchargeCents: 200, categoryName: 'Pizzas Especiales' });
  });

  it('una Gourmet: + S/ 4', () => {
    expect(priceFlavoredLine(PROMO_GRANDE, [[ALBORADA]], catalog).unitPriceCents).toBe(4500);
  });

  it('mezcla de categorías: suma el adicional de cada pizza', () => {
    const result = priceFlavoredLine(PROMO_2_GRANDES, [[ARAGUANEY], [LLANERA]], catalog);
    expect(result.unitPriceCents).toBe(8000 + 200 + 800);
  });

  it('2 sabores dentro de una pizza de promo: primero el más caro, luego su adicional', () => {
    const result = priceFlavoredLine(PROMO_2_GRANDES, [[HAWAIANA, ALBORADA], [PEPPERONI, GOLOSA]], catalog);
    expect(result.unitPriceCents).toBe(8000 + 400 + 200);
    expect(result.pizzas[0]).toMatchObject({ pricedBy: { name: 'Alborada' }, categoryName: 'Pizzas Gourmet', surchargeCents: 400 });
    expect(result.pizzas[1]).toMatchObject({ pricedBy: { name: 'Golosa' }, surchargeCents: 200 });
  });

  it('exige exactamente las pizzas que incluye la promo', () => {
    expectCode(() => priceFlavoredLine(PROMO_2_GRANDES, [[HAWAIANA]], catalog), 'wrong_pizza_count');
    expectCode(() => priceFlavoredLine(PROMO_GRANDE, [[HAWAIANA], [PEPPERONI]], catalog), 'wrong_pizza_count');
  });

  it('el adicional depende del tamaño de la promo (Mediana)', () => {
    const promoMedianas = { kind: 'promo', itemId: 39, basePriceCents: 6000, pizzaCount: 2, sizeId: MEDIANA } as const;
    expect(priceFlavoredLine(promoMedianas, [[ALBORADA], [GOLOSA]], catalog).unitPriceCents).toBe(6000 + 400 + 200);
  });

  it('sin categoría base (Clásicas) no se puede calcular el adicional', () => {
    const sinBase = { ...catalog, baseCategoryId: null };
    expectCode(() => priceFlavoredLine(PROMO_GRANDE, [[HAWAIANA]], sinBase), 'base_missing');
  });

  it('una categoría más barata que Clásicas nunca rebaja la promo (adicional ≥ 0)', () => {
    const barata = new Map(catalog.categories);
    barata.set(50, { id: 50, name: 'Pizzas Personales', listPriceCentsBySize: prices(2000, 3000, 4000) });
    const flavors = new Map(catalog.flavors);
    flavors.set(500, { itemId: 500, name: 'Mini', categoryId: 50, priceCentsBySize: prices(2000, 3000, 4000) });
    const result = priceFlavoredLine(PROMO_GRANDE, [[500]], { ...catalog, categories: barata, flavors });
    expect(result.unitPriceCents).toBe(4100);
  });

  it('con sobreprecio por ítem cobra el adicional MAYOR entre los sabores de la pizza (conservador)', () => {
    // Una Clásica con override más caro que la Especial elegida: el adicional sigue siendo el de Especial.
    const flavors = new Map(catalog.flavors);
    flavors.set(103, { itemId: 103, name: 'Clásica Premium', categoryId: CLASICAS, priceCentsBySize: prices(2500, 4000, 4500) });
    const result = priceFlavoredLine(PROMO_GRANDE, [[103, ARAGUANEY]], { ...catalog, flavors });
    expect(result.pizzas[0]).toMatchObject({ pricedBy: { name: 'Clásica Premium' }, surchargeCents: 200, categoryName: 'Pizzas Especiales' });
    expect(result.unitPriceCents).toBe(4300);
  });
});

describe('buildFlavorCatalog', () => {
  it('solo pizzas, precios en céntimos y Clásicas por slug', () => {
    const built = buildFlavorCatalog(
      [
        { id: 1, slug: 'clasicas', name: 'Pizzas Clásicas', hasSizes: true, listPrices: [{ sizeId: GRANDE, price: 35 }] },
        { id: 2, slug: 'especiales', name: 'Pizzas Especiales', hasSizes: true, listPrices: [{ sizeId: GRANDE, price: 37 }] },
        { id: 3, slug: 'bebidas', name: 'Bebidas', hasSizes: false, listPrices: [] },
      ],
      [
        { id: 10, name: 'Hawaiana', categoryId: 1, prices: [{ sizeId: GRANDE, price: 35 }] },
        { id: 11, name: 'Araguaney', categoryId: 2, prices: [{ sizeId: GRANDE, price: 37.5 }] },
        { id: 12, name: 'Gaseosa', categoryId: 3, prices: [] },
      ],
    );
    expect(built.baseCategoryId).toBe(1);
    expect([...built.flavors.keys()]).toEqual([10, 11]);
    expect(built.flavors.get(11)?.priceCentsBySize[GRANDE]).toBe(3750);
    const promo = { kind: 'promo', itemId: 9, basePriceCents: 4100, pizzaCount: 1, sizeId: GRANDE } as const;
    expect(priceFlavoredLine(promo, [[11]], built).unitPriceCents).toBe(4300);
  });
});

describe('normalizeLineNote', () => {
  it('recorta, colapsa espacios y devuelve null si queda vacía', () => {
    expect(normalizeLineNote('  sin   cebolla  ')).toBe('sin cebolla');
    expect(normalizeLineNote('   ')).toBeNull();
    expect(normalizeLineNote(undefined)).toBeNull();
  });

  it('quita caracteres de control y bidi', () => {
    expect(normalizeLineNote('bien\u0000 cocida‮')).toBe('bien cocida');
  });

  it('corta al máximo permitido', () => {
    expect(normalizeLineNote('a'.repeat(500))?.length).toBe(200);
  });
});

describe('cartLineIdentity', () => {
  it('distingue sabores y notas, pero no el orden de las pizzas internas', () => {
    const a = cartLineIdentity(1, 2, [[3, 4]], null);
    expect(a).toBe(cartLineIdentity(1, 2, [[3, 4]], null));
    expect(a).not.toBe(cartLineIdentity(1, 2, [[3, 5]], null));
    expect(a).not.toBe(cartLineIdentity(1, 2, [[3, 4]], 'sin cebolla'));
    expect(cartLineIdentity(1, null, null, null)).toBe('1:0');
  });
});

describe('parseSaleItemFlavors', () => {
  it('acepta el snapshot válido y descarta JSON roto o con forma inesperada', () => {
    const snapshot = {
      kind: 'promo',
      pizzas: [
        {
          flavors: [{ itemId: 1, name: 'Hawaiana' }],
          pricedBy: { itemId: 1, name: 'Hawaiana' },
          categoryName: 'Pizzas Clásicas',
          surchargeCents: 0,
        },
      ],
    };
    expect(parseSaleItemFlavors(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(parseSaleItemFlavors(null)).toBeNull();
    expect(parseSaleItemFlavors('{roto')).toBeNull();
    expect(parseSaleItemFlavors('{"kind":"x","pizzas":[]}')).toBeNull();
  });
});

describe('ticketDetailLines', () => {
  const promo = priceFlavoredLine(PROMO_2_GRANDES, [[HAWAIANA, LLANERA], [PEPPERONI]], catalog);

  it('promo: una línea por pizza, el adicional auditable y la nota', () => {
    expect(
      ticketDetailLines({ flavors: { kind: 'promo', pizzas: promo.pizzas }, note: 'sin cebolla', quantity: 1 }),
    ).toEqual(['Pizza 1: Hawaiana / Llanera', 'Adicional Pizzas de la Casa +S/ 8.00', 'Pizza 2: Pepperoni', 'Nota: sin cebolla']);
  });

  it('pizza de 2 sabores: dice qué sabor fija el precio; con cantidad > 1 marca c/u', () => {
    const pizza = priceFlavoredLine({ kind: 'pizza', itemId: HAWAIANA, sizeId: GRANDE }, [[HAWAIANA, LLANERA]], catalog);
    expect(ticketDetailLines({ flavors: { kind: 'pizza', pizzas: pizza.pizzas }, note: null, quantity: 2 })).toEqual([
      'Sabores: Hawaiana / Llanera',
      'Precio de Llanera',
    ]);
    const promoDos = ticketDetailLines({ flavors: { kind: 'promo', pizzas: promo.pizzas }, note: null, quantity: 2 });
    expect(promoDos[1]).toBe('Adicional Pizzas de la Casa +S/ 8.00 c/u');
  });

  it('venta histórica sin sabores ni nota: sin detalle', () => {
    expect(ticketDetailLines({ flavors: null, note: null, quantity: 1 })).toEqual([]);
  });
});

describe('wrapTicketText', () => {
  it('parte por palabras al ancho del papel con sangría', () => {
    expect(wrapTicketText('Nota: sin cebolla y bien cocida por favor', 20, 3)).toEqual([
      '   Nota: sin cebolla',
      '   y bien cocida por',
      '   favor',
    ]);
  });

  it('corta palabras más largas que el ancho', () => {
    expect(wrapTicketText('abcdefghij', 8, 2)).toEqual(['  abcdef', '  ghij']);
  });
});
