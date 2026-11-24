import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Size } from '@sabor/shared';
import {
  basePortionOf,
  resolveItemPrice,
  suggestPortionPrices,
  toPortionOverrides,
  validatePortions,
} from './portionPrices';

function portion(id: number, units: number): Size {
  return { id, key: `p${units}`, labelEs: `P${units}`, labelEn: '', detailEs: '', detailEn: '', displayOrder: 100 + id, kind: 'portion', units };
}

const PORTIONS = [portion(5, 6), portion(6, 12), portion(7, 18), portion(8, 24)];

describe('sugerencia proporcional', () => {
  it('parte del precio de la docena: mitad, x1,5 y x2', () => {
    const suggested = suggestPortionPrices(PORTIONS, 36, null);
    assert.deepEqual([...suggested.entries()], [[5, 18], [6, 36], [7, 54], [8, 72]]);
  });

  it('sin precio de docena usa el precio base y redondea a centavos', () => {
    const suggested = suggestPortionPrices(PORTIONS, null, 10.5);
    assert.equal(suggested.get(5), 5.25);
    assert.equal(suggested.get(7), 15.75);
  });

  it('sin referencia no sugiere nada', () => {
    assert.equal(suggestPortionPrices(PORTIONS, null, null).size, 0);
    assert.equal(suggestPortionPrices(PORTIONS, 0, null).size, 0);
  });
});

describe('payload y precio del ítem', () => {
  it('toPortionOverrides omite presentaciones vacías o en cero', () => {
    const values = new Map<number, number | null>([[5, 20], [6, null], [7, 0], [8, 70]]);
    assert.deepEqual(toPortionOverrides(values), [{ sizeId: 5, price: 20 }, { sizeId: 8, price: 70 }]);
  });

  it('price es el de 1 docena si está activa; si no, el base de referencia', () => {
    assert.equal(basePortionOf(PORTIONS)?.id, 6);
    assert.equal(resolveItemPrice(new Map([[6, 36]]), 6, 12), 36);
    assert.equal(resolveItemPrice(new Map([[5, 20]]), 6, 12), 12);
    assert.equal(resolveItemPrice(new Map<number, number | null>([[6, null]]), 6, 12), 12);
  });
});

describe('validación', () => {
  it('exige al menos una presentación activa', () => {
    const errors = validatePortions(new Map<number, number | null>([[5, null], [6, null]]));
    assert.match(errors.general ?? '', /al menos una presentación/);
  });

  it('marca el campo con precio no positivo', () => {
    const errors = validatePortions(new Map<number, number | null>([[5, -3], [6, 36]]));
    assert.equal(errors.general, null);
    assert.deepEqual([...errors.fields.keys()], [5]);
  });

  it('acepta presentaciones con precio positivo', () => {
    const errors = validatePortions(new Map<number, number | null>([[6, 36]]));
    assert.equal(errors.fields.size, 0);
    assert.equal(errors.general, null);
  });
});
