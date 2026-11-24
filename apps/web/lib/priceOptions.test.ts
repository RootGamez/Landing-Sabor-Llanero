import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ResolvedPrice, Size } from "@sabor/shared";
import {
  optionDetailFor,
  optionKindOf,
  optionLabelFor,
  priceSummary,
  unitsLabel,
} from "./priceOptions.ts";

const portion = (sizeId: number, price: number, units: number, labelEs: string, labelEn: string): ResolvedPrice => ({
  sizeId,
  sizeKey: `p${units}`,
  price,
  isOverride: true,
  kind: "portion",
  units,
  labelEs,
  labelEn,
});

const media = portion(10, 18, 6, "Media docena", "Half dozen");
const docena = portion(11, 36, 12, "1 docena", "1 dozen");
const mediana: ResolvedPrice = { sizeId: 1, sizeKey: "mediana", price: 25, isOverride: false };
const sizes: Size[] = [
  { id: 1, key: "mediana", labelEs: "Mediana", labelEn: "Medium", detailEs: "", detailEn: "", displayOrder: 1 },
];

describe("optionKindOf", () => {
  it("detecta presentaciones y trata la ausencia de kind como tamaño", () => {
    assert.equal(optionKindOf([media, docena]), "portion");
    assert.equal(optionKindOf([mediana]), "size");
    assert.equal(optionKindOf([]), "size");
  });
});

describe("optionLabelFor", () => {
  it("usa el label bilingüe de la presentación sin depender de GET /sizes", () => {
    assert.equal(optionLabelFor(media, [], "es"), "Media docena");
    assert.equal(optionLabelFor(media, [], "en"), "Half dozen");
  });

  it("cae a español si falta el label en inglés y a las unidades si faltan ambos", () => {
    assert.equal(optionLabelFor({ ...media, labelEn: "" }, [], "en"), "Media docena");
    assert.equal(optionLabelFor({ ...media, labelEs: "", labelEn: "" }, [], "es"), "6 unidades");
  });

  it("resuelve tamaños por la tabla, por el diccionario y por el key", () => {
    assert.equal(optionLabelFor(mediana, sizes, "en"), "Medium");
    assert.equal(optionLabelFor(mediana, [], "en"), "Medium");
    assert.equal(optionLabelFor({ ...mediana, sizeKey: "personal" }, [], "es"), "Personal");
  });
});

describe("optionDetailFor / unitsLabel", () => {
  it("muestra las unidades solo en presentaciones", () => {
    assert.equal(optionDetailFor(media, [], "es"), "6 unidades");
    assert.equal(optionDetailFor(media, [], "en"), "6 units");
    assert.equal(optionDetailFor(mediana, sizes, "es"), null);
  });

  it("singulariza y descarta valores inválidos", () => {
    assert.equal(unitsLabel(1, "es"), "1 unidad");
    assert.equal(unitsLabel(0, "es"), null);
    assert.equal(unitsLabel(null, "en"), null);
  });
});

describe("priceSummary", () => {
  it("muestra 'desde' con varias opciones sin elegir", () => {
    assert.deepEqual(priceSummary([docena, media], null), { mode: "from", amount: 18 });
  });

  it("muestra el precio de la opción elegida", () => {
    assert.deepEqual(priceSummary([media, docena], 11), { mode: "selected", amount: 36 });
  });

  it("no dice 'desde' con una sola opción y es nulo sin opciones", () => {
    assert.deepEqual(priceSummary([media], null), { mode: "single", amount: 18 });
    assert.equal(priceSummary([], null), null);
  });
});
