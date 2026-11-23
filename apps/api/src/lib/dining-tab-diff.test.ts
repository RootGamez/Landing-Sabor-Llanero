import { describe, expect, it } from 'vitest';
import { diffTabItems, tabItemKey } from './dining-tab-diff';

const saved = [
  { id: 10, itemId: 1, sizeId: 2, quantity: 2 },
  { id: 11, itemId: 5, sizeId: null, quantity: 1 },
  { id: 12, itemId: null, sizeId: null, quantity: 3 },
];

describe('diffTabItems', () => {
  it('sin cambios no produce operaciones', () => {
    const diff = diffTabItems(saved, [
      { itemId: 1, sizeId: 2, quantity: 2 },
      { itemId: 5, quantity: 1 },
    ]);
    expect(diff).toEqual({ inserts: [], updates: [], deletes: [], reducesSaved: false });
  });

  it('una nueva tanda suma productos y cantidades sin reducir lo guardado', () => {
    const diff = diffTabItems(saved, [
      { itemId: 1, sizeId: 2, quantity: 3 },
      { itemId: 5, quantity: 1 },
      { itemId: 7, quantity: 2 },
    ]);
    expect(diff.inserts).toEqual([{ itemId: 7, quantity: 2 }]);
    expect(diff.updates).toEqual([{ id: 10, quantity: 3 }]);
    expect(diff.deletes).toEqual([]);
    expect(diff.reducesSaved).toBe(false);
  });

  it('bajar una cantidad o quitar un producto guardado marca reducesSaved', () => {
    expect(diffTabItems(saved, [{ itemId: 1, sizeId: 2, quantity: 1 }, { itemId: 5, quantity: 1 }]).reducesSaved).toBe(true);
    const removed = diffTabItems(saved, [{ itemId: 1, sizeId: 2, quantity: 2 }]);
    expect(removed.deletes).toEqual([11]);
    expect(removed.reducesSaved).toBe(true);
  });

  it('distingue tamaños del mismo producto y conserva filas de productos borrados del menú', () => {
    const diff = diffTabItems(saved, [
      { itemId: 1, sizeId: 3, quantity: 1 },
      { itemId: 1, sizeId: 2, quantity: 2 },
      { itemId: 5, quantity: 1 },
    ]);
    expect(diff.inserts).toEqual([{ itemId: 1, sizeId: 3, quantity: 1 }]);
    expect(diff.deletes).not.toContain(12);
  });

  it('la clave trata "sin tamaño" igual con null o undefined', () => {
    expect(tabItemKey(4, null)).toBe(tabItemKey(4, undefined));
  });

  it('sabores o nota distintos son otra línea: cambiarlos borra la vieja e inserta la nueva', () => {
    const withFlavors = [{ id: 21, itemId: 1, sizeId: 2, quantity: 1, flavors: [[1, 7]], note: 'sin cebolla' }];
    expect(diffTabItems(withFlavors, [{ itemId: 1, sizeId: 2, quantity: 1, flavors: [[1, 7]], note: 'sin cebolla' }])).toEqual({
      inserts: [],
      updates: [],
      deletes: [],
      reducesSaved: false,
    });
    const changed = diffTabItems(withFlavors, [{ itemId: 1, sizeId: 2, quantity: 1, flavors: [[1, 8]], note: 'sin cebolla' }]);
    expect(changed.inserts).toHaveLength(1);
    expect(changed.deletes).toEqual([21]);
    expect(changed.reducesSaved).toBe(true);
    const plainToo = diffTabItems(withFlavors, [
      { itemId: 1, sizeId: 2, quantity: 1, flavors: [[1, 7]], note: 'sin cebolla' },
      { itemId: 1, sizeId: 2, quantity: 1 },
    ]);
    expect(plainToo.inserts).toEqual([{ itemId: 1, sizeId: 2, quantity: 1 }]);
    expect(plainToo.deletes).toEqual([]);
  });
});
