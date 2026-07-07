/**
 * Contratos de request/response de la API (aún no implementada — fase 3 del
 * refactor). Web, CMS y API importarán estos tipos para no desincronizarse,
 * igual que en Jaw.
 */
import type { Category, EventType, MenuItem } from './types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface UpdateProfileInput {
  name: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Cambiar la contraseña invalida todos los tokens anteriores (token_version);
 * se devuelve un token nuevo para que la sesión actual siga viva.
 */
export interface ChangePasswordResponse {
  token: string;
}

/** Precio de un tamaño dentro de un input de categoría o ítem. */
export interface SizePriceInput {
  sizeId: number;
  price: number;
}

/**
 * Alta de categoría. Si `hasSizes` es true, `prices` debe traer un precio
 * para cada tamaño activo del negocio (lo valida `createCategorySchema` en
 * validation.ts; la lista exacta de tamaños activos la resuelve la API
 * contra la DB).
 */
export interface CreateCategoryInput {
  slug: string;
  nameEs: string;
  nameEn?: string;
  hasSizes: boolean;
  displayOrder?: number;
  isActive?: boolean;
  prices?: SizePriceInput[];
}

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

/**
 * Alta de ítem de menú. `price` solo tiene sentido si la categoría destino
 * NO tiene tamaños; `priceOverrides` solo si SÍ los tiene. La validación
 * cruzada contra `categoryId` (que exige consultar la DB) la hace la API;
 * `createMenuItemSchema` en validation.ts solo valida la forma del input
 * (ambos campos no pueden venir a la vez).
 */
export interface CreateMenuItemInput {
  categoryId: number;
  /** Si se omite, la API lo genera a partir de nameEs (igual que en Jaw). */
  slug?: string;
  nameEs: string;
  nameEn?: string;
  descriptionEs?: string;
  descriptionEn?: string;
  price?: number | null;
  priceOverrides?: SizePriceInput[];
  isFeatured?: boolean;
  isActive?: boolean;
  displayOrder?: number;
}

export type UpdateMenuItemInput = Partial<CreateMenuItemInput>;

export interface PaginatedQuery {
  page?: number;
  pageSize?: number;
}

export interface MenuItemListQuery extends PaginatedQuery {
  categoryId?: number;
  search?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Sección del catálogo agrupado: una categoría con sus ítems activos
 * (respuesta de GET /categories/sections). Categorías sin ítems activos no
 * se incluyen.
 */
export interface MenuSection {
  category: Category;
  items: MenuItem[];
}

export interface RegisterEventInput {
  itemId: number;
  type: EventType;
}

export interface WhatsappUpdateInput {
  phoneNumber?: string;
  messageTemplateEs?: string;
  messageTemplateEn?: string;
}

export interface MediaOrderInput {
  displayOrder: number;
}

export interface ReportDateRangeQuery {
  from?: string; // ISO date
  to?: string; // ISO date
}
