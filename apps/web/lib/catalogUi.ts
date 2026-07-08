/**
 * Diccionario de UI del catálogo COMPLEMENTARIO al `CATALOG_COPY` de
 * @sabor/shared (que ya cubre orderOnWhatsapp/from/noItems/etc.). Vive acá
 * y no en shared porque el contrato del paquete compartido está cerrado
 * (fase 2); estas strings son detalles de presentación de la landing.
 */
import type { Lang } from "@sabor/shared";

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
