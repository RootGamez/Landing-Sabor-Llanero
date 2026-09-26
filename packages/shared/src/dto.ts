/**
 * Contratos de request/response de la API. Web, CMS y API importan estos
 * tipos para no desincronizarse, igual que en Jaw.
 */
import type { Category, EventType, MenuItem, Order, OrderItem, OrderStatus, RewardRedemption } from './types';

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

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/** Respuesta genérica de un solo mensaje (ej. forgot-password: mismo 200 exista o no la cuenta). */
export interface MessageResponse {
  message: string;
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

/**
 * Edición de una colección de merchandising. La `key` es inmutable (no viene
 * acá): se elige por la URL (`PATCH /collections/:key`) y la API valida que
 * sea una de `COLLECTION_KEYS` antes de tocar la DB.
 */
export interface UpdateCollectionInput {
  titleEs?: string;
  titleEn?: string;
  isActive?: boolean;
}

/** Un ítem dentro del input de reemplazo de `PUT /collections/:key/items`. */
export interface CollectionItemInput {
  itemId: number;
  displayOrder?: number;
}

/**
 * Reemplaza el set completo de ítems de una colección (curaduría manual del
 * dueño, no más de 20 por colección para que siga siendo "lo destacado").
 */
export interface ReplaceCollectionItemsInput {
  items: CollectionItemInput[];
}

export interface CustomerRegisterInput {
  email: string;
  password: string;
  name: string;
  phone: string;
}

export interface CustomerLoginInput {
  email: string;
  password: string;
}

/** Mismo shape que `LoginResponse` de staff, pero firmado con `CUSTOMER_JWT_SECRET` (ver P2.2). */
export interface CustomerLoginResponse {
  token: string;
}

export interface UpdateCustomerProfileInput {
  name?: string;
  phone?: string;
}

/** Un ítem del carrito al crear un pedido. El precio SIEMPRE se recalcula server-side (P2.3). */
export interface OrderItemInput {
  itemId: number;
  sizeId?: number;
  quantity: number;
}

export interface CreateOrderInput {
  items: OrderItemInput[];
}

/** `pending` no es un destino válido: solo lo asigna la API al crear el pedido. */
export interface OrderStatusUpdateInput {
  status: Extract<OrderStatus, 'confirmed' | 'cancelled'>;
}

/** Pedido con sus ítems, como lo devuelve la API (GET /orders, GET /orders/me). */
export interface OrderDto extends Order {
  items: OrderItem[];
}

export interface RewardInput {
  nameEs: string;
  nameEn?: string;
  descriptionEs?: string;
  descriptionEn?: string;
  pointsCost: number;
  price: number;
  discountPrice?: number;
  isActive?: boolean;
  displayOrder?: number;
}

export interface LoyaltyConfigUpdateInput {
  pointsPerCurrencyUnit?: number;
  minOrderAmountForPoints?: number;
}

/** Saldo de puntos del cliente logueado (GET /rewards o similar en P2.4/P2.8). */
export interface PointsBalanceDto {
  pointsBalance: number;
}

/**
 * Respuesta de POST /rewards/:id/redeem: la redención creada, el pedido real
 * que generó (pendiente de aceptación del local) y el saldo restante.
 */
export interface RedeemRewardResponse {
  redemption: RewardRedemption;
  order: OrderDto;
  pointsBalance: number;
}

/** Si se omite `period`, la API sortea/lista el mes calendario actual ('YYYY-MM'). */
export interface DrawRaffleInput {
  period?: string;
}
