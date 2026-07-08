/**
 * Formas de respuesta propias del CMS que no viven en @sabor/shared porque
 * son shapes ad-hoc de ciertos endpoints (categorías con sus precios por
 * tamaño ya resueltos, ítems con portada resuelta). Ver apps/api/src/routes
 * para el shape exacto de cada respuesta.
 */
import type { Category, CategoryPrice, MenuItem, MenuItemMedia } from '@sabor/shared';

export interface CategoryWithPrices extends Category {
  prices: CategoryPrice[];
}

export interface MenuItemWithCover extends MenuItem {
  coverImageKey: string | null;
}

export interface MenuItemDetailAdmin extends MenuItem {
  media: MenuItemMedia[];
  category: Pick<Category, 'id' | 'slug' | 'nameEs' | 'nameEn' | 'hasSizes'>;
  prices: Array<{ sizeId: number; sizeKey: string; price: number; isOverride: boolean }>;
}

export interface OrderClickRow {
  itemId: number;
  nameEs: string;
  nameEn: string;
  clicks: number;
  [key: string]: unknown;
}

export interface ByCategoryRow {
  categoryId: number;
  nameEs: string;
  nameEn: string;
  total: number;
  [key: string]: unknown;
}
