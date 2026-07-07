/**
 * Tipos base del dominio, en espejo del esquema SQL propuesto (BLUEPRINT §4.1).
 * Reflejan las columnas de D1 tal cual, en camelCase. Cambiar el esquema
 * implica tocar la migración + Row/mapper de la API + este archivo, juntos.
 */

export type Role = 'owner' | 'admin';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  /** Último login exitoso (null si nunca inició sesión). */
  lastLoginAt: string | null;
}

/**
 * Tamaño global del negocio (Mediana/Grande/Familiar). Es tabla y no enum
 * para poder agregar un tamaño nuevo (ej. "Personal") desde una migración,
 * con sus propios labels bilingües, sin tocar código.
 */
export interface Size {
  id: number;
  /** Identificador estable usado en lógica de negocio: 'mediana' | 'grande' | 'familiar' | ... */
  key: string;
  labelEs: string;
  labelEn: string;
  detailEs: string;
  detailEn: string;
  displayOrder: number;
}

/**
 * Categoría bilingüe. `hasSizes` decide el modo de precio de sus ítems:
 *   true  → los ítems se venden por tamaño; el precio base vive en
 *           `CategoryPrice` y puede sobreescribirse por ítem en `ItemPrice`.
 *   false → cada ítem tiene su propio precio único (`MenuItem.price`).
 */
export interface Category {
  id: number;
  slug: string;
  nameEs: string;
  nameEn: string;
  hasSizes: boolean;
  displayOrder: number;
  /** Clave R2 del banner de la categoría (opcional, gestionado desde el CMS). */
  bannerImageKey: string | null;
  isActive: boolean;
  createdAt: string;
}

/** Precio por tamaño a nivel categoría: el default que heredan sus ítems. */
export interface CategoryPrice {
  id: number;
  categoryId: number;
  sizeId: number;
  price: number;
}

/**
 * Ítem del menú, bilingüe y sin stock (requisito 4 del BLUEPRINT: el
 * catálogo es vitrina, no hay inventario). `price` solo aplica a ítems de
 * categorías con `hasSizes = false`; en categorías con tamaños queda `null`
 * y el precio se resuelve vía `CategoryPrice`/`ItemPrice` (ver pricing.ts).
 */
export interface MenuItem {
  id: number;
  categoryId: number;
  slug: string;
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
  descriptionEn: string;
  price: number | null;
  /** Ítem destacado (ej. Pizza Alborada), para resaltarlo en el catálogo. */
  isFeatured: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Override de precio por tamaño a nivel ítem (requisito 2 del BLUEPRINT).
 * Si un ítem no tiene fila acá para un tamaño dado, rige `CategoryPrice`.
 * Solo tiene sentido para ítems de categorías con `hasSizes = true`.
 */
export interface ItemPrice {
  id: number;
  itemId: number;
  sizeId: number;
  price: number;
}

export type MediaType = 'image' | 'video';

/** Media de un ítem del menú (calcado de product_media de Jaw). */
export interface MenuItemMedia {
  id: number;
  itemId: number;
  type: MediaType;
  r2Key: string;
  displayOrder: number;
  createdAt: string;
}

/** Configuración de WhatsApp, con plantilla de mensaje por idioma. */
export interface WhatsappConfig {
  id: number;
  phoneNumber: string;
  messageTemplateEs: string;
  messageTemplateEn: string;
  updatedAt: string;
}

export type EventType = 'view' | 'order_click';

export interface AnalyticsEvent {
  id: number;
  itemId: number;
  type: EventType;
  createdAt: string;
}

/**
 * Precio ya resuelto de un ítem para un tamaño dado (BLUEPRINT §4.2). La API
 * responde siempre con precios resueltos vía `resolveItemPrices` (ver
 * pricing.ts) — el público nunca calcula precios en el cliente.
 */
export interface ResolvedPrice {
  sizeId: number;
  sizeKey: string;
  price: number;
  /** true si el precio viene de un override en ItemPrice; false si se heredó de CategoryPrice. */
  isOverride: boolean;
}

/**
 * Ítem con sus relaciones cargadas, como lo devuelve GET /menu-items/:slug.
 * En categorías con tamaños, `prices` trae un `ResolvedPrice` por cada
 * tamaño activo y `price` (heredado de MenuItem) queda en null. En
 * categorías sin tamaños, `prices` queda vacío y el precio propio vive en
 * `price`.
 */
export interface MenuItemDetail extends MenuItem {
  media: MenuItemMedia[];
  category: Pick<Category, 'id' | 'slug' | 'nameEs' | 'nameEn' | 'hasSizes'>;
  prices: ResolvedPrice[];
}
