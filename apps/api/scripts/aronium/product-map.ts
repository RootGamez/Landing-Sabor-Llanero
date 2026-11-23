import type { MapRow, MenuEntry, RawProduct, SizeKey } from './types';

/** NFKD sin acentos, minúsculas y espacios colapsados. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const SIZE_BY_GROUP: Readonly<Record<string, SizeKey>> = {
  'pizzas medianas': 'mediana',
  'pizzas grandes': 'grande',
  'pizzas familiares': 'familiar',
};

/** El tamaño de una pizza viene en el grupo de Aronium; el resto no tiene tamaño. */
export function sizeFromGroup(groupName: string): SizeKey | null {
  return SIZE_BY_GROUP[normalizeName(groupName)] ?? null;
}

export type MatchResult = { status: 'auto'; itemId: number; itemSlug: string | null } | { status: 'unmatched' };

const NON_ASCII_RUN = /[^\x00-\x7f]+/;
// Un carácter acentuado roto puede haber quedado como 0-3 caracteres basura.
const BROKEN_GAP = '[a-z0-9 ]{0,3}';

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pickUnique(candidates: readonly MenuEntry[]): MatchResult {
  const [only] = candidates;
  if (candidates.length !== 1 || !only) return { status: 'unmatched' };
  return { status: 'auto', itemId: only.id, itemSlug: only.slug ?? null };
}

function looseMatch(key: string, menu: readonly MenuEntry[]): readonly MenuEntry[] {
  const parts = key.split(NON_ASCII_RUN).map(escapeRegex);
  const pattern = new RegExp(`^${parts.join(BROKEN_GAP)}$`);
  return menu.filter((entry) => pattern.test(normalizeName(entry.nameEs)));
}

/**
 * Empareja por nombre normalizado. Si el nombre trae caracteres rotos
 * (`Champi�on`) cae a una comparación tolerante. Ambiguo = sin emparejar.
 */
export function matchMenuItem(legacyName: string, menu: readonly MenuEntry[]): MatchResult {
  const key = normalizeName(legacyName);
  const exact = menu.filter((entry) => normalizeName(entry.nameEs) === key);
  if (exact.length > 0) return pickUnique(exact);
  if (!NON_ASCII_RUN.test(key)) return { status: 'unmatched' };
  return pickUnique(looseMatch(key, menu));
}

export function buildMapRows(products: readonly RawProduct[], menu: readonly MenuEntry[]): MapRow[] {
  return products.map((product) => {
    const match = matchMenuItem(product.name, menu);
    return {
      legacyId: product.id,
      legacyName: product.name,
      legacyGroup: product.groupName,
      itemId: match.status === 'auto' ? match.itemId : null,
      itemSlug: match.status === 'auto' ? match.itemSlug : null,
      sizeKey: sizeFromGroup(product.groupName),
      status: match.status,
    };
  });
}

/** Completa item_slug en filas que solo traen item_id (p. ej. editadas a mano en el CSV). */
export function fillSlugs(rows: readonly MapRow[], menu: readonly MenuEntry[]): MapRow[] {
  const slugById = new Map(menu.map((entry) => [entry.id, entry.slug ?? null]));
  return rows.map((row) => {
    if (row.itemSlug !== null || row.itemId === null) return row;
    if (!slugById.has(row.itemId)) throw new Error(`legacy_id ${row.legacyId}: el item_id ${row.itemId} no está en el menú`);
    return { ...row, itemSlug: slugById.get(row.itemId) ?? null };
  });
}

/** Slugs del CSV que no existen en el menú del destino (esas líneas quedarían sin ítem). */
export function missingSlugs(rows: readonly MapRow[], menu: readonly MenuEntry[]): string[] {
  const known = new Set(menu.map((entry) => entry.slug).filter((slug): slug is string => slug !== undefined));
  const slugs = rows.map((row) => row.itemSlug).filter((slug): slug is string => slug !== null);
  return [...new Set(slugs.filter((slug) => !known.has(slug)))];
}
