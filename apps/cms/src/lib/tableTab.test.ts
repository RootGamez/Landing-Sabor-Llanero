import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DiningTab } from '@sabor/shared';
import { lineKey, type CartLine } from './posCart';
import {
  formatElapsed,
  isDraftDirty,
  isStaleTab,
  lockedTabItems,
  newUnitsCount,
  planBox,
  rebaseDraft,
  savedQuantities,
  tabToCartLines,
} from './tableTab';

function line(itemId: number, quantity: number, sizeId: number | null = null): CartLine {
  return { key: lineKey(itemId, sizeId), itemId, sizeId, name: `P${itemId}`, sizeLabel: null, unitPriceCents: 1000, quantity };
}

const tab: DiningTab = {
  id: 1,
  tableId: 3,
  status: 'open',
  version: 2,
  openedAt: '2026-11-23 12:00:00',
  updatedAt: '2026-11-23 12:10:00',
  openedBy: 1,
  saleId: null,
  totalCents: 4500,
  itemCount: 4,
  items: [
    { id: 1, itemId: 10, sizeId: 2, name: 'Pizza', sizeLabel: 'Grande', unitPriceCents: 3000, quantity: 1, lineTotalCents: 3000 },
    { id: 2, itemId: 11, sizeId: null, name: 'Gaseosa', sizeLabel: null, unitPriceCents: 500, quantity: 2, lineTotalCents: 1000 },
    { id: 3, itemId: null, sizeId: null, name: 'Borrado', sizeLabel: null, unitPriceCents: 500, quantity: 1, lineTotalCents: 500 },
  ],
};

describe('cuenta ↔ ticket', () => {
  it('una presentación guardada vuelve al ticket con su sizeId, etiqueta y precio', () => {
    const portionTab: DiningTab = {
      ...tab,
      items: [{ id: 9, itemId: 20, sizeId: 5, name: 'Tequeños', sizeLabel: 'Media docena', unitPriceCents: 2000, quantity: 2, lineTotalCents: 4000 }],
    };
    const [only] = tabToCartLines(portionTab);
    assert.deepEqual([only?.key, only?.sizeId, only?.sizeLabel, only?.unitPriceCents], ['20:5', 5, 'Media docena', 2000]);
  });

  it('convierte la cuenta en líneas editables y aparta los productos borrados del menú', () => {
    const lines = tabToCartLines(tab);
    assert.deepEqual(lines.map((l) => [l.key, l.quantity, l.unitPriceCents]), [
      ['10:2', 1, 3000],
      ['11:0', 2, 500],
    ]);
    assert.equal(lockedTabItems(tab).length, 1);
    assert.deepEqual(tabToCartLines(null), []);
  });

  it('detecta cambios sin guardar y cuenta las unidades nuevas', () => {
    const saved = savedQuantities(tab);
    const lines = tabToCartLines(tab);
    assert.equal(isDraftDirty(lines, saved), false);
    const more = [...lines.map((l) => (l.itemId === 11 ? { ...l, quantity: 3 } : l)), line(12, 2)];
    assert.equal(isDraftDirty(more, saved), true);
    assert.equal(newUnitsCount(more, saved), 3);
    assert.equal(isDraftDirty(lines.slice(1), saved), true);
  });
});

describe('rebaseDraft', () => {
  it('suma lo agregado localmente sobre la versión nueva del servidor', () => {
    const before = new Map([['1:0', 1]]);
    const local = [line(1, 3), line(2, 1)];
    const server = [line(1, 2), line(5, 1)];
    const merged = rebaseDraft(before, local, server);
    assert.deepEqual(merged.map((l) => [l.key, l.quantity]), [
      ['1:0', 4],
      ['5:0', 1],
      ['2:0', 1],
    ]);
  });

  it('descarta las reducciones locales (se respetan las del servidor)', () => {
    const before = new Map([['1:0', 3]]);
    const merged = rebaseDraft(before, [line(1, 1)], [line(1, 3)]);
    assert.deepEqual(merged.map((l) => l.quantity), [3]);
  });
});

describe('tiempo abierta', () => {
  const opened = '2026-11-23 12:00:00';
  const at = (minutes: number) => Date.UTC(2026, 10, 23, 12, 0, 0) + minutes * 60_000;

  it('formatea minutos, horas y días', () => {
    assert.equal(formatElapsed(opened, at(0)), 'Recién');
    assert.equal(formatElapsed(opened, at(25)), '25 min');
    assert.equal(formatElapsed(opened, at(65)), '1 h 05 min');
    assert.equal(formatElapsed(opened, at(60 * 27)), '1 d 3 h');
    assert.equal(formatElapsed('basura', at(5)), 'Recién');
  });

  it('marca como olvidada una cuenta de más de 12 h', () => {
    assert.equal(isStaleTab(opened, at(60 * 11)), false);
    assert.equal(isStaleTab(opened, at(60 * 12)), true);
  });
});

describe('planBox', () => {
  it('escala las celdas a porcentajes del plano', () => {
    assert.deepEqual(planBox({ x: 1, y: 0, w: 4, h: 2 }, 8), {
      left: `${(1 / 12) * 100}%`,
      top: '0%',
      width: `${(4 / 12) * 100}%`,
      height: '25%',
    });
  });
});
