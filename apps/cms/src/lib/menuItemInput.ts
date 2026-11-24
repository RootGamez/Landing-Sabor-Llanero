/** Arma el payload de `POST/PATCH /menu-items` a partir del estado del formulario de ítem. */
import type { CreateMenuItemInput } from '@sabor/shared';
import { resolveItemPrice, toPortionOverrides, type PortionValues } from './portionPrices';
import { slugify } from './slug';

/** Payload de ítem: `CreateMenuItemInput` del DTO más la promo de pizzas (0011), que aún no está en el DTO. */
export type MenuItemPayload = CreateMenuItemInput & {
  promoPizzaCount?: number | null;
  promoPizzaSizeId?: number | null;
};

export interface MenuItemFormValues {
  categoryId: number;
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
  descriptionEn: string;
  slug: string | undefined;
  hasSizes: boolean;
  /** Precio propio (categorías sin tamaños) o base de referencia (con presentaciones). */
  price: number | null;
  /** Overrides por tamaño de pizza (categorías con tamaños). */
  overrides: ReadonlyMap<number, number | null>;
  sellByPortions: boolean;
  portionValues: PortionValues;
  basePortionId: number | undefined;
  /** El ítem ya tenía presentaciones guardadas (para quitarlas al desactivarlas). */
  hadPortions: boolean;
  promoCount: number | null;
  promoSizeId: number | null;
  /** Promo guardada, para enviarla solo si cambió. */
  savedPromo: { count: number | null; sizeId: number | null };
  isFeatured: boolean;
  isActive: boolean;
}

function sizeOverrides(overrides: ReadonlyMap<number, number | null>): Array<{ sizeId: number; price: number }> {
  return [...overrides.entries()]
    .filter((entry): entry is [number, number] => entry[1] != null && entry[1] > 0)
    .map(([sizeId, price]) => ({ sizeId, price }));
}

/** Cuántas pizzas incluye la promo (entero ≥ 1) o null si no aplica. */
export function promoCountOf(value: number | null): number | null {
  return value != null && value > 0 ? Math.round(value) : null;
}

function priceFields(v: MenuItemFormValues): Pick<CreateMenuItemInput, 'price' | 'priceOverrides'> {
  // Invariante BLUEPRINT §4.2: con tamaños el ítem no lleva price propio.
  if (v.hasSizes) return { price: null, priceOverrides: sizeOverrides(v.overrides) };
  if (v.sellByPortions) {
    return {
      price: resolveItemPrice(v.portionValues, v.basePortionId, v.price),
      priceOverrides: toPortionOverrides(v.portionValues),
    };
  }
  // `[]` quita las presentaciones guardadas; omitir el campo las conservaría.
  return { price: v.price, ...(v.hadPortions ? { priceOverrides: [] } : {}) };
}

function promoFields(v: MenuItemFormValues): Pick<MenuItemPayload, 'promoPizzaCount' | 'promoPizzaSizeId'> | undefined {
  if (v.hasSizes) return undefined;
  // Con presentaciones la promo de pizzas no aplica: si había una guardada, se limpia.
  if (v.sellByPortions) return v.savedPromo.count === null ? undefined : { promoPizzaCount: null, promoPizzaSizeId: null };
  const count = promoCountOf(v.promoCount);
  // Solo se envía si cambió: así el guardado no depende de la migración 0011 en ítems sin promo.
  if (count === v.savedPromo.count && v.promoSizeId === v.savedPromo.sizeId) return undefined;
  return { promoPizzaCount: count, promoPizzaSizeId: count === null ? null : v.promoSizeId };
}

export function buildMenuItemInput(v: MenuItemFormValues): MenuItemPayload {
  return {
    categoryId: v.categoryId,
    nameEs: v.nameEs.trim(),
    nameEn: v.nameEn.trim(),
    descriptionEs: v.descriptionEs.trim(),
    descriptionEn: v.descriptionEn.trim(),
    slug: v.slug ?? slugify(v.nameEs),
    ...priceFields(v),
    ...promoFields(v),
    isFeatured: v.isFeatured,
    isActive: v.isActive,
  };
}
