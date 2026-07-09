/**
 * Búsqueda client-side del catálogo. El catálogo entero ya vive en memoria
 * (GET /menu-items/sections trae todas las categorías con sus ítems), así que
 * filtrar acá evita un round-trip por tecla y funciona sin conexión una vez
 * cargada la carta.
 *
 * Se busca sobre nombre Y descripción, en los DOS idiomas: la descripción es
 * donde el CMS lista los ingredientes, así que "tocineta" o "bacon" encuentran
 * la misma pizza sin importar el toggle ES/EN activo.
 */
import type { MenuItemWithPrices } from "@sabor/shared";

/** Minúsculas y sin tildes: "Jamón" y "jamon" deben ser la misma consulta. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Tokeniza la consulta en palabras. Cada token debe aparecer en el ítem (AND),
 * de modo que "pizza pollo" no devuelva todas las pizzas.
 */
export function toSearchTokens(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

function haystackOf(item: MenuItemWithPrices): string {
  return normalizeText(
    `${item.nameEs} ${item.nameEn} ${item.descriptionEs} ${item.descriptionEn}`,
  );
}

export function itemMatchesTokens(item: MenuItemWithPrices, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const haystack = haystackOf(item);
  return tokens.every((token) => haystack.includes(token));
}
