import { describe, expect, it } from 'vitest';
import { assertOverrideKinds, resolveItemPrices, resolvePortionPrices } from './pricing';
import { createMenuItemSchema, updateMenuItemSchema } from './validation';
import type { ItemPrice, Size } from './types';

const size = (id: number, key: string, displayOrder: number): Size => ({
  id,
  key,
  labelEs: key,
  labelEn: key,
  detailEs: '',
  detailEn: '',
  displayOrder,
  kind: 'size',
  units: null,
});

const portion = (id: number, key: string, labelEs: string, units: number, displayOrder: number): Size => ({
  id,
  key,
  labelEs,
  labelEn: labelEs,
  detailEs: `${units} unidades`,
  detailEn: `${units} pieces`,
  displayOrder,
  kind: 'portion',
  units,
});

const MEDIANA = size(1, 'mediana', 1);
const MEDIA_DOCENA = portion(101, 'media_docena', 'Media docena', 6, 100);
const DOCENA = portion(102, 'docena', '1 docena', 12, 101);
const DOS_DOCENAS = portion(104, 'dos_docenas', '2 docenas', 24, 103);
const ALL = [MEDIANA, DOS_DOCENAS, MEDIA_DOCENA, DOCENA];

const itemPrice = (itemId: number, sizeId: number, price: number): ItemPrice => ({
  id: itemId * 1000 + sizeId,
  itemId,
  sizeId,
  price,
});

describe('resolvePortionPrices', () => {
  it('devuelve solo las presentaciones con precio del ítem, en orden de exhibición', () => {
    const prices = [itemPrice(7, 104, 70), itemPrice(7, 101, 20), itemPrice(7, 102, 36)];
    const resolved = resolvePortionPrices({ id: 7 }, prices, ALL);
    expect(resolved.map((p) => p.sizeId)).toEqual([101, 102, 104]);
    expect(resolved.map((p) => p.price)).toEqual([20, 36, 70]);
  });

  it('incluye kind, units y labels para que el cliente no tenga que cruzar con /sizes', () => {
    const [first] = resolvePortionPrices({ id: 7 }, [itemPrice(7, 101, 20)], ALL);
    expect(first).toEqual({
      sizeId: 101,
      sizeKey: 'media_docena',
      price: 20,
      isOverride: true,
      kind: 'portion',
      units: 6,
      labelEs: 'Media docena',
      labelEn: 'Media docena',
    });
  });

  it('ignora filas de otros ítems y de tamaños (kind=size)', () => {
    const prices = [itemPrice(8, 101, 99), itemPrice(7, MEDIANA.id, 50)];
    expect(resolvePortionPrices({ id: 7 }, prices, ALL)).toEqual([]);
  });

  it('sin filas devuelve []', () => {
    expect(resolvePortionPrices({ id: 7 }, [], ALL)).toEqual([]);
  });

  it('redondea a 2 decimales', () => {
    const [first] = resolvePortionPrices({ id: 7 }, [itemPrice(7, 102, 12.345)], ALL);
    expect(first?.price).toBe(12.35);
  });
});

describe('resolveItemPrices con presentaciones en la lista de tamaños', () => {
  it('nunca incluye presentaciones aunque exista una fila item_prices ajena', () => {
    const resolved = resolveItemPrices(
      { id: 7 },
      { id: 1, hasSizes: true },
      ALL,
      [{ id: 1, categoryId: 1, sizeId: MEDIANA.id, price: 20 }],
      [itemPrice(7, 101, 5)],
    );
    expect(resolved.map((p) => p.sizeId)).toEqual([MEDIANA.id]);
  });
});

describe('assertOverrideKinds', () => {
  it('categoría con tamaños: solo admite kind=size', () => {
    expect(assertOverrideKinds([{ sizeId: 1 }], ALL, true)).toBeNull();
    expect(assertOverrideKinds([{ sizeId: 101 }], ALL, true)).toMatch(/tamaños/);
  });

  it('categoría sin tamaños: solo admite kind=portion', () => {
    expect(assertOverrideKinds([{ sizeId: 101 }, { sizeId: 104 }], ALL, false)).toBeNull();
    expect(assertOverrideKinds([{ sizeId: 1 }], ALL, false)).toMatch(/presentaciones/);
  });

  it('no permite mezclar tipos', () => {
    expect(assertOverrideKinds([{ sizeId: 1 }, { sizeId: 101 }], ALL, false)).not.toBeNull();
    expect(assertOverrideKinds([{ sizeId: 1 }, { sizeId: 101 }], ALL, true)).not.toBeNull();
  });

  it('un id inexistente se reporta como inexistente', () => {
    expect(assertOverrideKinds([{ sizeId: 999 }], ALL, false)).toMatch(/999/);
  });

  it('lista vacía es válida', () => {
    expect(assertOverrideKinds([], ALL, false)).toBeNull();
    expect(assertOverrideKinds([], ALL, true)).toBeNull();
  });

  it('una lista de sizes sin kind se trata como tamaños (retrocompatibilidad)', () => {
    const legacy: Size[] = [{ ...MEDIANA, kind: undefined, units: undefined }];
    expect(assertOverrideKinds([{ sizeId: 1 }], legacy, true)).toBeNull();
  });
});

describe('validateMenuItemPrices (Zod) con presentaciones', () => {
  const base = { categoryId: 3, nameEs: 'Tequeños' };

  it('admite price junto a priceOverrides (ítem de categoría sin tamaños con presentaciones)', () => {
    const parsed = createMenuItemSchema.safeParse({
      ...base,
      price: 36,
      priceOverrides: [{ sizeId: 101, price: 20 }],
    });
    expect(parsed.success).toBe(true);
  });

  it('sigue rechazando sizeId duplicado en priceOverrides', () => {
    const parsed = updateMenuItemSchema.safeParse({
      priceOverrides: [
        { sizeId: 101, price: 20 },
        { sizeId: 101, price: 30 },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});
