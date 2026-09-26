/**
 * Filas tal cual las devuelve D1 (snake_case) y mappers a los tipos de dominio
 * (camelCase, en @sabor/shared). D1 no tiene ORM: se mapea a mano.
 * Regla: cambio de esquema ⇒ tocar migración + Row + mapper + tipo compartido, juntos.
 */
import type {
  AnalyticsEvent,
  Category,
  CategoryPrice,
  Collection,
  CollectionKey,
  Customer,
  ItemPrice,
  LoyaltyConfig,
  MenuItem,
  MenuItemMedia,
  Order,
  OrderItem,
  OrderSource,
  OrderStatus,
  PointsLedgerEntry,
  PointsLedgerReason,
  RaffleDraw,
  RaffleEntry,
  RedemptionStatus,
  Reward,
  RewardRedemption,
  Size,
  User,
  WhatsappConfig,
} from '@sabor/shared';

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: 'owner' | 'admin';
  token_version: number;
  last_login_at: string | null;
  created_at: string;
}
export const mapUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  name: r.name,
  role: r.role,
  createdAt: r.created_at,
  lastLoginAt: r.last_login_at,
});

export interface SizeRow {
  id: number;
  key: string;
  label_es: string;
  label_en: string;
  detail_es: string;
  detail_en: string;
  display_order: number;
}
export const mapSize = (r: SizeRow): Size => ({
  id: r.id,
  key: r.key,
  labelEs: r.label_es,
  labelEn: r.label_en,
  detailEs: r.detail_es,
  detailEn: r.detail_en,
  displayOrder: r.display_order,
});

export interface CategoryRow {
  id: number;
  slug: string;
  name_es: string;
  name_en: string;
  has_sizes: number;
  display_order: number;
  banner_image_key: string | null;
  is_active: number;
  created_at: string;
}
export const mapCategory = (r: CategoryRow): Category => ({
  id: r.id,
  slug: r.slug,
  nameEs: r.name_es,
  nameEn: r.name_en,
  hasSizes: Boolean(r.has_sizes),
  displayOrder: r.display_order,
  bannerImageKey: r.banner_image_key,
  isActive: Boolean(r.is_active),
  createdAt: r.created_at,
});

export interface CategoryPriceRow {
  id: number;
  category_id: number;
  size_id: number;
  price: number;
}
export const mapCategoryPrice = (r: CategoryPriceRow): CategoryPrice => ({
  id: r.id,
  categoryId: r.category_id,
  sizeId: r.size_id,
  price: r.price,
});

export interface MenuItemRow {
  id: number;
  category_id: number;
  slug: string;
  name_es: string;
  name_en: string;
  description_es: string;
  description_en: string;
  price: number | null;
  is_featured: number;
  is_active: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}
export const mapMenuItem = (r: MenuItemRow): MenuItem => ({
  id: r.id,
  categoryId: r.category_id,
  slug: r.slug,
  nameEs: r.name_es,
  nameEn: r.name_en,
  descriptionEs: r.description_es,
  descriptionEn: r.description_en,
  price: r.price,
  isFeatured: Boolean(r.is_featured),
  isActive: Boolean(r.is_active),
  displayOrder: r.display_order,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface ItemPriceRow {
  id: number;
  item_id: number;
  size_id: number;
  price: number;
}
export const mapItemPrice = (r: ItemPriceRow): ItemPrice => ({
  id: r.id,
  itemId: r.item_id,
  sizeId: r.size_id,
  price: r.price,
});

export interface MediaRow {
  id: number;
  item_id: number;
  type: 'image' | 'video';
  r2_key: string;
  display_order: number;
  created_at: string;
}
export const mapMedia = (r: MediaRow): MenuItemMedia => ({
  id: r.id,
  itemId: r.item_id,
  type: r.type,
  r2Key: r.r2_key,
  displayOrder: r.display_order,
  createdAt: r.created_at,
});

export interface WhatsappRow {
  id: number;
  phone_number: string;
  message_template_es: string;
  message_template_en: string;
  updated_at: string;
}
export const mapWhatsapp = (r: WhatsappRow): WhatsappConfig => ({
  id: r.id,
  phoneNumber: r.phone_number,
  messageTemplateEs: r.message_template_es,
  messageTemplateEn: r.message_template_en,
  updatedAt: r.updated_at,
});

export interface CollectionRow {
  id: number;
  key: string;
  title_es: string;
  title_en: string;
  is_active: number;
  display_order: number;
}
export const mapCollection = (r: CollectionRow): Collection => ({
  id: r.id,
  // La key es cerrada (COLLECTION_KEYS) por diseño de dominio, no por CHECK
  // en la columna SQL; el cast es seguro porque solo el seed de la migración
  // inserta filas y la key nunca se edita (routes/collections.ts la valida).
  key: r.key as CollectionKey,
  titleEs: r.title_es,
  titleEn: r.title_en,
  isActive: Boolean(r.is_active),
  displayOrder: r.display_order,
});

/** Fila de collection_items sin mapper propio: solo se usa unida a menu_items en routes/collections.ts. */
export interface CollectionItemRow {
  id: number;
  collection_id: number;
  item_id: number;
  display_order: number;
}

export interface EventRow {
  id: number;
  item_id: number;
  type: 'view' | 'order_click';
  created_at: string;
}
export const mapEvent = (r: EventRow): AnalyticsEvent => ({
  id: r.id,
  itemId: r.item_id,
  type: r.type,
  createdAt: r.created_at,
});

export interface CustomerRow {
  id: number;
  email: string;
  phone: string;
  password_hash: string;
  name: string;
  points_balance: number;
  token_version: number;
  last_login_at: string | null;
  created_at: string;
}
export const mapCustomer = (r: CustomerRow): Customer => ({
  id: r.id,
  email: r.email,
  phone: r.phone,
  name: r.name,
  pointsBalance: r.points_balance,
  createdAt: r.created_at,
  lastLoginAt: r.last_login_at,
});

export interface OrderRow {
  id: number;
  customer_id: number;
  code: string;
  status: OrderStatus;
  subtotal: number;
  points_awarded: number | null;
  confirmed_at: string | null;
  confirmed_by: number | null;
  created_at: string;
  source: OrderSource;
}
export const mapOrder = (r: OrderRow): Order => ({
  id: r.id,
  customerId: r.customer_id,
  code: r.code,
  status: r.status,
  subtotal: r.subtotal,
  pointsAwarded: r.points_awarded,
  confirmedAt: r.confirmed_at,
  confirmedBy: r.confirmed_by,
  createdAt: r.created_at,
  source: r.source,
});

export interface OrderItemRow {
  id: number;
  order_id: number;
  item_id: number | null;
  reward_id: number | null;
  name_es: string;
  name_en: string;
  size_label: string | null;
  unit_price: number;
  quantity: number;
}
export const mapOrderItem = (r: OrderItemRow): OrderItem => ({
  id: r.id,
  orderId: r.order_id,
  itemId: r.item_id,
  rewardId: r.reward_id,
  nameEs: r.name_es,
  nameEn: r.name_en,
  sizeLabel: r.size_label,
  unitPrice: r.unit_price,
  quantity: r.quantity,
});

export interface PointsLedgerRow {
  id: number;
  customer_id: number;
  order_id: number | null;
  delta: number;
  reason: PointsLedgerReason;
  created_at: string;
}
export const mapPointsLedgerEntry = (r: PointsLedgerRow): PointsLedgerEntry => ({
  id: r.id,
  customerId: r.customer_id,
  orderId: r.order_id,
  delta: r.delta,
  reason: r.reason,
  createdAt: r.created_at,
});

export interface RewardRow {
  id: number;
  name_es: string;
  name_en: string;
  description_es: string;
  description_en: string;
  points_cost: number;
  image_r2_key: string | null;
  is_active: number;
  display_order: number;
  created_at: string;
  price: number | null;
  discount_price: number | null;
}
export const mapReward = (r: RewardRow): Reward => ({
  id: r.id,
  nameEs: r.name_es,
  nameEn: r.name_en,
  descriptionEs: r.description_es,
  descriptionEn: r.description_en,
  pointsCost: r.points_cost,
  imageR2Key: r.image_r2_key,
  isActive: Boolean(r.is_active),
  displayOrder: r.display_order,
  createdAt: r.created_at,
  price: r.price,
  discountPrice: r.discount_price,
});

export interface RewardRedemptionRow {
  id: number;
  customer_id: number;
  reward_id: number;
  points_spent: number;
  status: RedemptionStatus;
  created_at: string;
  fulfilled_at: string | null;
  fulfilled_by: number | null;
  order_id: number | null;
}
export const mapRewardRedemption = (r: RewardRedemptionRow): RewardRedemption => ({
  id: r.id,
  customerId: r.customer_id,
  rewardId: r.reward_id,
  pointsSpent: r.points_spent,
  status: r.status,
  createdAt: r.created_at,
  fulfilledAt: r.fulfilled_at,
  fulfilledBy: r.fulfilled_by,
  orderId: r.order_id,
});

export interface RaffleEntryRow {
  id: number;
  customer_id: number;
  order_id: number;
  period: string;
  created_at: string;
}
export const mapRaffleEntry = (r: RaffleEntryRow): RaffleEntry => ({
  id: r.id,
  customerId: r.customer_id,
  orderId: r.order_id,
  period: r.period,
  createdAt: r.created_at,
});

export interface RaffleDrawRow {
  id: number;
  period: string;
  winner_customer_id: number;
  winner_entry_id: number;
  drawn_at: string;
  drawn_by: number;
}
export const mapRaffleDraw = (r: RaffleDrawRow): RaffleDraw => ({
  id: r.id,
  period: r.period,
  winnerCustomerId: r.winner_customer_id,
  winnerEntryId: r.winner_entry_id,
  drawnAt: r.drawn_at,
  drawnBy: r.drawn_by,
});

export interface LoyaltyConfigRow {
  id: number;
  points_per_currency_unit: number;
  min_order_amount_for_points: number;
  updated_at: string;
}
export const mapLoyaltyConfig = (r: LoyaltyConfigRow): LoyaltyConfig => ({
  id: r.id,
  pointsPerCurrencyUnit: r.points_per_currency_unit,
  minOrderAmountForPoints: r.min_order_amount_for_points,
  updatedAt: r.updated_at,
});
