/**
 * Diccionario de UI del catálogo COMPLEMENTARIO al `CATALOG_COPY` de
 * @sabor/shared (que ya cubre orderOnWhatsapp/from/noItems/etc.). Vive acá
 * y no en shared porque el contrato del paquete compartido está cerrado
 * (fase 2); estas strings son detalles de presentación de la landing.
 */
import { displaySizeLabel, type Lang, type ResolvedPrice, type Size } from "@sabor/shared";

interface CatalogUiCopy {
  /** Kicker de la sección (pill sobre el título). */
  kicker: string;
  /** Título h2 de la sección (SEO: "Nuestra Carta" / "Our Menu"). */
  title: string;
  subtitle: string;
  loading: string;
  errorTitle: string;
  errorHint: string;
  retry: string;
  /** Hint bajo el botón de pedir cuando el ítem exige elegir tamaño. */
  chooseSize: string;
  /** aria-labels de los botones del carrusel. */
  prev: string;
  next: string;
  /** Prefijo de alt para fotos de ítems: "Foto de Pizza Alborada". */
  photoOf: string;
  /** aria-label del grupo del toggle de idioma. */
  langToggle: string;
  /** Label accesible y placeholder del buscador. */
  searchLabel: string;
  searchPlaceholder: string;
  searchClear: string;
  /** Singular/plural del contador de resultados: "12 resultados". */
  resultOne: string;
  resultMany: string;
  /** Estado vacío cuando ningún ítem coincide con el filtro. */
  noResultsTitle: string;
  noResultsHint: string;
  clearFilters: string;
  /** aria-label del grupo de chips de categoría y su opción "todas". */
  categoryFilter: string;
  allCategories: string;
  /** Affordance de la card y aria-label del botón que abre el modal. */
  viewDetails: string;
  /** aria-label del botón de cerrar del modal. */
  close: string;
  /** Encabezado de la lista de ingredientes en el modal. */
  ingredients: string;
}

export const CATALOG_UI: Record<Lang, CatalogUiCopy> = {
  es: {
    kicker: "La Carta",
    title: "Nuestra Carta",
    subtitle: "Elige tu favorita, escoge el tamaño y pídela directo por WhatsApp",
    loading: "Cargando la carta…",
    errorTitle: "No pudimos cargar la carta",
    errorHint: "Revisa tu conexión e inténtalo de nuevo.",
    retry: "Reintentar",
    chooseSize: "Elige un tamaño",
    prev: "Anterior",
    next: "Siguiente",
    photoOf: "Foto de",
    langToggle: "Idioma del menú",
    searchLabel: "Buscar en la carta",
    searchPlaceholder: "Busca por nombre o ingrediente (jamón, tocineta…)",
    searchClear: "Limpiar búsqueda",
    resultOne: "resultado",
    resultMany: "resultados",
    noResultsTitle: "No encontramos nada con eso",
    noResultsHint: "Prueba con otro ingrediente o mira la carta completa.",
    clearFilters: "Ver la carta completa",
    categoryFilter: "Filtrar por categoría",
    allCategories: "Todo",
    viewDetails: "Ver detalles",
    close: "Cerrar",
    ingredients: "Ingredientes",
  },
  en: {
    kicker: "The Menu",
    title: "Our Menu",
    subtitle: "Pick your favorite, choose a size and order straight on WhatsApp",
    loading: "Loading the menu…",
    errorTitle: "We couldn't load the menu",
    errorHint: "Check your connection and try again.",
    retry: "Try again",
    chooseSize: "Choose a size",
    prev: "Previous",
    next: "Next",
    photoOf: "Photo of",
    langToggle: "Menu language",
    searchLabel: "Search the menu",
    searchPlaceholder: "Search by name or ingredient (ham, bacon…)",
    searchClear: "Clear search",
    resultOne: "result",
    resultMany: "results",
    noResultsTitle: "We couldn't find anything",
    noResultsHint: "Try another ingredient or browse the full menu.",
    clearFilters: "Browse the full menu",
    categoryFilter: "Filter by category",
    allCategories: "All",
    viewDetails: "View details",
    close: "Close",
    ingredients: "Ingredients",
  },
};

/** Título bilingüe de una colección (mismo fallback en→es que displayName de shared). */
export function displayCollectionTitle(
  collection: { titleEs: string; titleEn: string },
  lang: Lang,
): string {
  return lang === "en" && collection.titleEn ? collection.titleEn : collection.titleEs;
}

/**
 * Fallback bilingüe de los `sizeKey` conocidos (seed.sql: mediana/grande/
 * familiar) para cuando GET /sizes falla y ItemCard no tiene el label real
 * de la BD. Antes se capitalizaba el key crudo, lo que mostraba "Mediana"
 * incluso en inglés.
 */
export const SIZE_KEY_FALLBACK: Record<Lang, Record<string, string>> = {
  es: { mediana: "Mediana", grande: "Grande", familiar: "Familiar" },
  en: { mediana: "Medium", grande: "Large", familiar: "Family" },
};

/**
 * Label visible de un tamaño. Fuente primaria: el `Size` real de la BD. Si
 * GET /sizes falló, cae al diccionario bilingüe de keys conocidos y, como
 * último recurso, capitaliza el key crudo. Compartido por ItemCard e ItemModal.
 */
export function sizeLabelFor(price: ResolvedPrice, sizes: Size[], lang: Lang): string {
  const size = sizes.find((s) => s.id === price.sizeId);
  if (size) return displaySizeLabel(size, lang);

  const known = SIZE_KEY_FALLBACK[lang][price.sizeKey];
  if (known) return known;
  return price.sizeKey.charAt(0).toUpperCase() + price.sizeKey.slice(1);
}
