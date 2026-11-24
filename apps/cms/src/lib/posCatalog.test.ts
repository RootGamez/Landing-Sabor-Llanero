import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MenuItemWithPrices, ResolvedPrice, Size } from '@sabor/shared';
import { addLine, lineKey, toSaleItems, type CartLine } from './posCart';
import { buildCatalog, displayPrice, priceLookup, type PosMenuSection } from './posCatalog';

const MEDIANA = 1;
const MEDIA_DOCENA = 5;
const DOCENA = 6;
const DOCENA_Y_MEDIA = 7;

const SIZES: Size[] = [
  { id: MEDIANA, key: 'mediana', labelEs: 'Mediana', labelEn: 'Medium', detailEs: '', detailEn: '', displayOrder: 1, kind: 'size', units: null },
  { id: MEDIA_DOCENA, key: 'media_docena', labelEs: 'Media docena', labelEn: 'Half dozen', detailEs: '6 unidades', detailEn: '', displayOrder: 100, kind: 'portion', units: 6 },
  { id: DOCENA, key: 'docena', labelEs: '1 docena', labelEn: '1 dozen', detailEs: '12 unidades', detailEn: '', displayOrder: 101, kind: 'portion', units: 12 },
  { id: DOCENA_Y_MEDIA, key: 'docena_y_media', labelEs: 'Docena y media', labelEn: '', detailEs: '18 unidades', detailEn: '', displayOrder: 102, kind: 'portion', units: 18 },
];

function portion(sizeId: number, key: string, labelEs: string, units: number, price: number): ResolvedPrice {
  return { sizeId, sizeKey: key, price, isOverride: true, kind: 'portion', units, labelEs, labelEn: '' };
}

function item(id: number, categoryId: number, price: number | null, prices: ResolvedPrice[]): MenuItemWithPrices {
  return {
    id,
    categoryId,
    slug: `i-${id}`,
    nameEs: `Item ${id}`,
    nameEn: '',
    descriptionEs: '',
    descriptionEn: '',
    price,
    channel: 'both',
    isFeatured: false,
    isActive: true,
    displayOrder: 0,
    createdAt: '',
    updatedAt: '',
    promoPizzaCount: null,
    promoPizzaSizeId: null,
    prices,
    coverImageKey: null,
  };
}

function section(id: number, hasSizes: boolean, items: MenuItemWithPrices[]): PosMenuSection {
  return {
    category: { id, slug: `c-${id}`, nameEs: `Cat ${id}`, nameEn: '', hasSizes, displayOrder: id, bannerImageKey: null, isActive: true, createdAt: '' },
    items,
  };
}

const TEQUENOS = item(10, 2, 36, [
  portion(MEDIA_DOCENA, 'media_docena', 'Media docena', 6, 20),
  portion(DOCENA, 'docena', '1 docena', 12, 36),
  portion(DOCENA_Y_MEDIA, 'docena_y_media', 'Docena y media', 18, 52),
]);
const PASTELITOS = item(11, 2, 12, []);
const PIZZA = item(1, 1, null, [{ sizeId: MEDIANA, sizeKey: 'mediana', price: 20, isOverride: false }]);

const catalog = buildCatalog([section(1, true, [PIZZA]), section(2, false, [TEQUENOS, PASTELITOS])], SIZES);
const product = (id: number) => catalog.products.find((p) => p.id === id)!;

describe('opciones de venta del POS', () => {
  it('un ítem sin tamaños con presentaciones se vende por ellas, con etiqueta, unidades y precio', () => {
    assert.deepEqual(
      product(10).options.map((o) => [o.sizeId, o.label, o.units, o.priceCents]),
      [
        [MEDIA_DOCENA, 'Media docena', 6, 2000],
        [DOCENA, '1 docena', 12, 3600],
        [DOCENA_Y_MEDIA, 'Docena y media', 18, 5200],
      ],
    );
  });

  it('un ítem sin tamaños ni presentaciones conserva su precio único sin sizeId', () => {
    assert.deepEqual(product(11).options, [{ sizeId: null, label: null, priceCents: 1200 }]);
  });

  it('las pizzas siguen vendiéndose por tamaño, sin unidades, y admiten sabores', () => {
    assert.deepEqual(product(1).options, [{ sizeId: MEDIANA, label: 'Mediana', priceCents: 2000 }]);
    assert.equal(product(1).isPizza, true);
    assert.equal(product(10).isPizza, false);
  });

  it('la tarjeta muestra "desde" el menor precio cuando hay varias presentaciones', () => {
    assert.deepEqual(displayPrice(product(10)), { cents: 2000, isFrom: true });
    assert.deepEqual(displayPrice(product(11)), { cents: 1200, isFrom: false });
  });
});

describe('ticket con presentaciones', () => {
  function addPortion(lines: CartLine[], sizeId: number): CartLine[] {
    const option = product(10).options.find((o) => o.sizeId === sizeId)!;
    return addLine(lines, { itemId: 10, sizeId, name: 'Item 10', sizeLabel: option.label, unitPriceCents: option.priceCents });
  }

  it('cada presentación es una línea distinta con su sizeId y el total correcto', () => {
    let lines = addPortion([], MEDIA_DOCENA);
    lines = addPortion(lines, DOCENA_Y_MEDIA);
    lines = addPortion(lines, MEDIA_DOCENA);
    assert.deepEqual(lines.map((l) => l.key), [lineKey(10, MEDIA_DOCENA), lineKey(10, DOCENA_Y_MEDIA)]);
    assert.deepEqual(
      toSaleItems(lines).map((l) => [l.itemId, l.sizeId, l.quantity]),
      [
        [10, MEDIA_DOCENA, 2],
        [10, DOCENA_Y_MEDIA, 1],
      ],
    );
    assert.equal(lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0), 2 * 2000 + 5200);
  });

  it('priceLookup re-precia una línea de presentación y descarta la que ya no existe', () => {
    const lookup = priceLookup(catalog);
    assert.deepEqual(lookup(10, MEDIA_DOCENA), { name: 'Item 10', sizeLabel: 'Media docena', unitPriceCents: 2000 });
    assert.equal(lookup(10, 99), undefined);
  });
});
