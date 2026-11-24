/**
 * Lógica pura de las opciones de precio de un ítem: tamaños de pizza
 * (`kind = 'size'`) o presentaciones (`kind = 'portion'`: Media docena,
 * 1 docena…). Sin imports de runtime a propósito: se prueba con `node --test`
 * (ver `priceOptions.test.ts`) y la usan la card, el modal y el selector.
 */
import type { Lang, ResolvedPrice, Size } from "@sabor/shared";

export type OptionKind = "size" | "portion";

/**
 * Fallback bilingüe de los `sizeKey` conocidos (seed.sql: mediana/grande/
 * familiar) para cuando GET /sizes falla y no hay label real de la BD.
 */
const SIZE_KEY_FALLBACK: Record<Lang, Record<string, string>> = {
  es: { mediana: "Mediana", grande: "Grande", familiar: "Familiar" },
  en: { mediana: "Medium", grande: "Large", familiar: "Family" },
};

/** Tipo de un precio: ausente = 'size' (datos viejos de la API). */
export function priceKindOf(price: Pick<ResolvedPrice, "kind">): OptionKind {
  return price.kind === "portion" ? "portion" : "size";
}

/** Tipo de las opciones de un ítem. Una categoría nunca mezcla ambos tipos. */
export function optionKindOf(prices: ReadonlyArray<Pick<ResolvedPrice, "kind">>): OptionKind {
  return prices.some((price) => priceKindOf(price) === "portion") ? "portion" : "size";
}

/** "6 unidades" / "6 units"; `null` si no hay unidades (tamaños). */
export function unitsLabel(units: number | null | undefined, lang: Lang): string | null {
  if (units == null || units <= 0) return null;
  if (lang === "en") return units === 1 ? "1 unit" : `${units} units`;
  return units === 1 ? "1 unidad" : `${units} unidades`;
}

function pickByLang(es: string | undefined, en: string | undefined, lang: Lang): string | null {
  const value = lang === "en" && en ? en : es;
  return value ? value : null;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Label visible de una opción. Presentaciones: el label bilingüe que ya
 * viene en el precio; si faltara, el de `GET /sizes` y, al final, sus
 * unidades. Tamaños: el `Size` real de la BD, luego el diccionario de keys
 * conocidos y, como último recurso, el key capitalizado.
 */
export function optionLabelFor(price: ResolvedPrice, sizes: readonly Size[], lang: Lang): string {
  const size = sizes.find((candidate) => candidate.id === price.sizeId);
  const fromSize = size ? pickByLang(size.labelEs, size.labelEn, lang) : null;

  if (priceKindOf(price) === "portion") {
    return (
      pickByLang(price.labelEs, price.labelEn, lang) ??
      fromSize ??
      unitsLabel(price.units ?? size?.units, lang) ??
      capitalize(price.sizeKey)
    );
  }
  return fromSize ?? SIZE_KEY_FALLBACK[lang][price.sizeKey] ?? capitalize(price.sizeKey);
}

/** Detalle secundario de una opción: las unidades de una presentación. */
export function optionDetailFor(price: ResolvedPrice, sizes: readonly Size[], lang: Lang): string | null {
  if (priceKindOf(price) !== "portion") return null;
  const size = sizes.find((candidate) => candidate.id === price.sizeId);
  return unitsLabel(price.units ?? size?.units, lang);
}

export interface PriceSummary {
  /** `selected` = precio de la opción elegida; `from` = hay varias y ninguna elegida; `single` = una sola. */
  mode: "selected" | "from" | "single";
  amount: number;
}

/** Precio a mostrar en card/modal: el de la opción elegida o el "desde" del ítem. */
export function priceSummary(
  prices: readonly ResolvedPrice[],
  selectedSizeId: number | null,
): PriceSummary | null {
  const selected = prices.find((price) => price.sizeId === selectedSizeId);
  if (selected) return { mode: "selected", amount: selected.price };

  const amounts = prices.map((price) => price.price);
  if (amounts.length === 0) return null;
  return { mode: amounts.length > 1 ? "from" : "single", amount: Math.min(...amounts) };
}
