/**
 * Filas tal cual las devuelve D1 (snake_case) y mappers a los tipos de dominio
 * (camelCase, en @sabor/shared). D1 no tiene ORM: se mapea a mano.
 * Regla: cambio de esquema ⇒ tocar migración + Row + mapper + tipo compartido, juntos.
 */
import type {
  AnalyticsEvent,
  Category,
  CategoryPrice,
  ItemPrice,
  MenuItem,
  MenuItemMedia,
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
