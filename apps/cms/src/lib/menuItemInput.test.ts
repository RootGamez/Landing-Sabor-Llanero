import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMenuItemSchema } from '@sabor/shared';
import { buildMenuItemInput, type MenuItemFormValues } from './menuItemInput';

const BASE: MenuItemFormValues = {
  categoryId: 2,
  nameEs: ' Tequeños ',
  nameEn: '',
  descriptionEs: '',
  descriptionEn: '',
  slug: undefined,
  hasSizes: false,
  price: 36,
  overrides: new Map(),
  sellByPortions: false,
  portionValues: new Map(),
  basePortionId: 6,
  hadPortions: false,
  promoCount: null,
  promoSizeId: null,
  savedPromo: { count: null, sizeId: null },
  isFeatured: false,
  isActive: true,
};

describe('payload del ítem', () => {
  it('sin presentaciones envía solo el precio único y no toca priceOverrides', () => {
    const input = buildMenuItemInput(BASE);
    assert.equal(input.price, 36);
    assert.equal('priceOverrides' in input, false);
    assert.equal(input.nameEs, 'Tequeños');
  });

  it('con presentaciones envía price = 1 docena y los priceOverrides activos', () => {
    const input = buildMenuItemInput({
      ...BASE,
      price: 10,
      sellByPortions: true,
      portionValues: new Map<number, number | null>([[5, 20], [6, 36], [7, null]]),
    });
    assert.equal(input.price, 36);
    assert.deepEqual(input.priceOverrides, [{ sizeId: 5, price: 20 }, { sizeId: 6, price: 36 }]);
    assert.equal(createMenuItemSchema.safeParse(input).success, true);
  });

  it('sin docena activa deja el precio base de referencia', () => {
    const input = buildMenuItemInput({ ...BASE, price: 15, sellByPortions: true, portionValues: new Map([[5, 20]]) });
    assert.equal(input.price, 15);
  });

  it('al desactivar presentaciones guardadas envía priceOverrides vacío para quitarlas', () => {
    const input = buildMenuItemInput({ ...BASE, hadPortions: true });
    assert.deepEqual(input.priceOverrides, []);
    assert.equal(input.price, 36);
  });

  it('no envía la promo de pizzas cuando el ítem se vende por presentaciones', () => {
    const input = buildMenuItemInput({
      ...BASE,
      sellByPortions: true,
      portionValues: new Map([[6, 36]]),
      promoCount: 2,
      promoSizeId: 1,
    });
    assert.equal('promoPizzaCount' in input, false);
  });

  it('en categorías con tamaños envía price null y los overrides de tamaño', () => {
    const input = buildMenuItemInput({ ...BASE, hasSizes: true, overrides: new Map<number, number | null>([[1, 22], [2, null]]) });
    assert.equal(input.price, null);
    assert.deepEqual(input.priceOverrides, [{ sizeId: 1, price: 22 }]);
  });
});
