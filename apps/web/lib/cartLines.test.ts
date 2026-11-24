import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCartLineKey,
  cartLineFromItem,
  findStaleLines,
  isCartLine,
  type CartLine,
} from "./cartLines.ts";

const tequenos = { id: 7, slug: "tequenos", price: 36 };

describe("cartLineFromItem", () => {
  it("no agrega un ítem con presentaciones sin haber elegido una", () => {
    const line = cartLineFromItem({
      item: tequenos,
      hasSizes: true,
      selectedPrice: null,
      name: "Tequeños",
      sizeLabel: null,
    });
    assert.equal(line, null);
  });

  it("guarda sizeId, label y precio de la presentación elegida", () => {
    const line = cartLineFromItem({
      item: tequenos,
      hasSizes: true,
      selectedPrice: { sizeId: 10, price: 18 },
      name: "Tequeños",
      sizeLabel: "Media docena",
    });
    assert.deepEqual(line, {
      key: "7:10",
      itemId: 7,
      itemSlug: "tequenos",
      name: "Tequeños",
      sizeId: 10,
      sizeLabel: "Media docena",
      unitPrice: 18,
    });
  });

  it("dos presentaciones del mismo ítem generan keys distintas (dos líneas)", () => {
    assert.notEqual(buildCartLineKey(7, 10), buildCartLineKey(7, 11));
  });

  it("un ítem sin opciones usa su precio único y la key base", () => {
    const line = cartLineFromItem({
      item: { id: 3, slug: "agua", price: 5 },
      hasSizes: false,
      selectedPrice: null,
      name: "Agua",
      sizeLabel: null,
    });
    assert.equal(line?.key, "3:base");
    assert.equal(line?.sizeId, null);
    assert.equal(line?.unitPrice, 5);
  });
});

const staleLine: CartLine = {
  key: "7:base",
  itemId: 7,
  itemSlug: "tequenos",
  name: "Tequeños",
  sizeId: null,
  sizeLabel: null,
  unitPrice: 36,
  quantity: 2,
};
const catalog = [
  {
    id: 7,
    prices: [
      { sizeId: 10, kind: "portion" as const },
      { sizeId: 11, kind: "portion" as const },
    ],
  },
  { id: 3, prices: [] },
];

describe("findStaleLines", () => {
  it("marca una línea vieja sin sizeId cuyo ítem ahora tiene presentaciones", () => {
    assert.equal(findStaleLines([staleLine], catalog).get("7:base"), "portion");
  });

  it("marca una línea cuya presentación ya no existe", () => {
    const gone = { ...staleLine, key: "7:99", sizeId: 99 };
    assert.equal(findStaleLines([gone], catalog).get("7:99"), "portion");
  });

  it("deja pasar líneas válidas, ítems sin opciones e ítems fuera de la carta", () => {
    const valid = { ...staleLine, key: "7:10", sizeId: 10 };
    const plain = { ...staleLine, key: "3:base", itemId: 3 };
    const unknown = { ...staleLine, key: "99:base", itemId: 99 };
    assert.equal(findStaleLines([valid, plain, unknown], catalog).size, 0);
  });
});

describe("isCartLine", () => {
  it("acepta carritos viejos guardados (sizeId null) y rechaza basura", () => {
    assert.equal(isCartLine(staleLine), true);
    assert.equal(isCartLine({ ...staleLine, quantity: 0 }), false);
    assert.equal(isCartLine(null), false);
  });
});
