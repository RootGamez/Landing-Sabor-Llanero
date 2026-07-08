/**
 * Estrategia de i18n del catálogo (BLUEPRINT §4.3): columnas `*_es`/`*_en`
 * fijas (no tabla de traducciones) — 2 idiomas, sin JOINs extra. La API
 * devuelve siempre ambos idiomas; el front elige y aplica fallback acá.
 */

export type Lang = 'es' | 'en';

/**
 * Regla de fallback: inglés vacío ⇒ cae a español (el CMS marca los ítems
 * sin traducir en vez de la API/front tener que adivinar).
 */
export function displayName(entity: { nameEs: string; nameEn: string }, lang: Lang): string {
  return lang === 'en' && entity.nameEn ? entity.nameEn : entity.nameEs;
}

export function displayDescription(
  entity: { descriptionEs: string; descriptionEn: string },
  lang: Lang,
): string {
  return lang === 'en' && entity.descriptionEn ? entity.descriptionEn : entity.descriptionEs;
}

export function displaySizeLabel(size: { labelEs: string; labelEn: string }, lang: Lang): string {
  return lang === 'en' && size.labelEn ? size.labelEn : size.labelEs;
}

export function displaySizeDetail(size: { detailEs: string; detailEn: string }, lang: Lang): string {
  return lang === 'en' && size.detailEn ? size.detailEn : size.detailEs;
}

interface CatalogCopy {
  menuTitle: string;
  orderOnWhatsapp: string;
  sizes: string;
  featured: string;
  promos: string;
  combos: string;
  seeMenu: string;
  /** Prefijo para "Desde S/ 25.00" en ítems con precio por tamaño. */
  from: string;
  noItems: string;
}

/**
 * Diccionario de UI del catálogo (toggle ES/EN del navbar, BLUEPRINT §4.3).
 * La landing existente queda en español (decisión abierta §7.3); esto cubre
 * solo la sección de menú.
 */
export const CATALOG_COPY: Record<Lang, CatalogCopy> = {
  es: {
    menuTitle: 'Nuestro Menú',
    orderOnWhatsapp: 'Pedir por WhatsApp',
    sizes: 'Tamaños',
    featured: 'Destacado',
    promos: 'Promos',
    combos: 'Combos',
    seeMenu: 'Ver menú',
    from: 'Desde',
    noItems: 'Todavía no hay ítems en esta categoría.',
  },
  en: {
    menuTitle: 'Our Menu',
    orderOnWhatsapp: 'Order on WhatsApp',
    sizes: 'Sizes',
    featured: 'Featured',
    promos: 'Deals',
    combos: 'Combos',
    seeMenu: 'View menu',
    from: 'From',
    noItems: 'No items in this category yet.',
  },
};
