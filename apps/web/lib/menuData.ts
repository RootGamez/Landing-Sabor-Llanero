/**
 * Fetchers del catálogo público (BLUEPRINT §5 "Integración en la landing").
 * Funciones module-level estables, pensadas para pasarse a `useAsync`.
 * La API responde con precios YA resueltos (§4.2): acá no se calcula nada.
 */
import type {
  Category,
  CollectionKey,
  CollectionWithItems,
  MenuItemWithPrices,
  Size,
  WhatsappConfig,
} from "@sabor/shared";
import { api } from "@/lib/api";
import { FALLBACK_WHATSAPP_CONFIG } from "@/lib/whatsapp";

/**
 * Sección del catálogo como la devuelve GET /menu-items/sections: los ítems
 * vienen con precios resueltos y portada (`MenuItemWithPrices`). El
 * `MenuSection` de shared tipa `items` como `MenuItem[]` (sin precios), por
 * eso se declara acá el shape real de la respuesta pública.
 */
export interface CatalogSection {
  category: Category;
  items: MenuItemWithPrices[];
}

export async function fetchCollections(signal: AbortSignal): Promise<CollectionWithItems[]> {
  const collections = (await api.get<CollectionWithItems[]>("/collections", signal)) ?? [];
  // El backend ya filtra colecciones inactivas; acá se descartan además las
  // vacías: una colección sin ítems no se renderiza (ni su título).
  return collections.filter((c) => c.isActive && c.items.length > 0);
}

export function findCollection(
  collections: CollectionWithItems[] | null,
  key: CollectionKey,
): CollectionWithItems | null {
  return collections?.find((c) => c.key === key) ?? null;
}

export async function fetchMenuSections(signal: AbortSignal): Promise<CatalogSection[]> {
  const sections = (await api.get<CatalogSection[]>("/menu-items/sections", signal)) ?? [];
  return sections.filter((s) => s.items.length > 0);
}

export async function fetchSizes(signal: AbortSignal): Promise<Size[]> {
  return (await api.get<Size[]>("/sizes", signal)) ?? [];
}

/**
 * Config de WhatsApp. GET /api/whatsapp es público (solo el PATCH exige
 * auth), así que se usa como fuente primaria (trae la plantilla real editada
 * por el dueño). Si falla, degrada al fallback estático construido desde
 * BRAND — el botón de pedir nunca queda roto.
 */
export async function fetchWhatsappConfig(signal: AbortSignal): Promise<WhatsappConfig> {
  try {
    const config = await api.get<WhatsappConfig>("/whatsapp", signal);
    return config ?? FALLBACK_WHATSAPP_CONFIG;
  } catch {
    return FALLBACK_WHATSAPP_CONFIG;
  }
}
