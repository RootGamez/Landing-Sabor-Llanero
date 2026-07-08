/**
 * Esquemas de validación (Zod) para los contratos de request de la API
 * (BLUEPRINT §4.2), calcados del estilo de Jaw
 * (`Jaw-Project/packages/shared/src/validation.ts`). Fuente única
 * compartida: la API valida al persistir y el CMS reusa los mismos esquemas
 * en formularios.
 *
 * Nota de diseño: las reglas que dependen de leer la DB (ej. "el ítem debe
 * traer precio para *todos* los tamaños activos de verdad", o "la categoría
 * de destino de un ítem sí tiene hasSizes=true") NO pueden vivir acá — este
 * paquete no tiene acceso a D1. Esa validación cruzada queda para la API
 * (BLUEPRINT §4.2, último bullet). Acá se valida todo lo que la forma del
 * input permite validar sin contexto externo.
 */
import { z } from 'zod';


const slugRegex = /^(?=.*[a-z])[a-z0-9]+(?:-[a-z0-9]+)*$/;


const PASSWORD_MAX = 128;
const passwordSchema = z
  .string()
  .min(8, 'la contraseña debe tener al menos 8 caracteres')
  .max(PASSWORD_MAX, `la contraseña no puede superar ${PASSWORD_MAX} caracteres`);

export const loginSchema = z.object({
  email: z.string().email('email inválido'),
  password: z.string().min(1, 'password requerido').max(PASSWORD_MAX, 'password inválido'),
});

export const createUserSchema = z.object({
  email: z.string().email('email inválido'),
  password: passwordSchema,
  name: z.string().min(1, 'name requerido'),
  role: z.enum(['owner', 'admin']),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['owner', 'admin']).optional(),
  password: passwordSchema.optional(),
});

/** Edición del perfil propio (cualquier rol): solo el nombre; email y rol los gestiona el owner. */
export const updateProfileSchema = z.object({
  name: z.string().min(1, 'name requerido'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'la contraseña actual es requerida').max(PASSWORD_MAX),
  newPassword: passwordSchema,
});

/** Precio de un tamaño dentro de un input de categoría o ítem. */
export const sizePriceInputSchema = z.object({
  sizeId: z.number().int().positive('sizeId inválido'),
  price: z.number().positive('price debe ser mayor a 0'),
});

const categoryBaseSchema = z.object({
  slug: z.string().regex(slugRegex, 'slug inválido (usar minúsculas, números y guiones, con al menos una letra)'),
  nameEs: z.string().min(1, 'nameEs requerido'),
  nameEn: z.string().default(''),
  hasSizes: z.boolean(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  prices: z.array(sizePriceInputSchema).optional(),
});

interface CategoryPriceShape {
  hasSizes?: boolean;
  prices?: Array<{ sizeId: number; price: number }>;
}


function validateCategoryPrices(data: CategoryPriceShape, ctx: z.RefinementCtx): void {
  if (data.hasSizes === true) {
    if (!data.prices || data.prices.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['prices'],
        message: 'una categoría con tamaños requiere precio para cada tamaño',
      });
      return;
    }
    const seen = new Set<number>();
    data.prices.forEach((entry, index) => {
      if (seen.has(entry.sizeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['prices', index, 'sizeId'],
          message: 'sizeId duplicado en prices',
        });
      }
      seen.add(entry.sizeId);
    });
  } else if (data.hasSizes === false && data.prices && data.prices.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['prices'],
      message: 'una categoría sin tamaños no admite precios por tamaño',
    });
  }
}

export const createCategorySchema = categoryBaseSchema.superRefine(validateCategoryPrices);
export const updateCategorySchema = categoryBaseSchema.partial().superRefine(validateCategoryPrices);

const menuItemBaseSchema = z.object({
  categoryId: z.number().int().positive('categoryId inválido'),
  slug: z
    .string()
    .regex(slugRegex, 'slug inválido (usar minúsculas, números y guiones, con al menos una letra)')
    .optional(),
  nameEs: z.string().min(1, 'nameEs requerido'),
  nameEn: z.string().default(''),
  descriptionEs: z.string().default(''),
  descriptionEn: z.string().default(''),
  price: z.number().positive('price debe ser mayor a 0').nullable().optional(),
  priceOverrides: z.array(sizePriceInputSchema).optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

interface MenuItemPriceShape {
  price?: number | null;
  priceOverrides?: Array<{ sizeId: number; price: number }>;
}


function validateMenuItemPrices(data: MenuItemPriceShape, ctx: z.RefinementCtx): void {
  if (data.price != null && data.priceOverrides && data.priceOverrides.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['price'],
      message: 'un ítem no puede tener price propio y priceOverrides al mismo tiempo',
    });
  }
  if (data.priceOverrides) {
    const seen = new Set<number>();
    data.priceOverrides.forEach((entry, index) => {
      if (seen.has(entry.sizeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['priceOverrides', index, 'sizeId'],
          message: 'sizeId duplicado en priceOverrides',
        });
      }
      seen.add(entry.sizeId);
    });
  }
}

export const createMenuItemSchema = menuItemBaseSchema.superRefine(validateMenuItemPrices);
export const updateMenuItemSchema = menuItemBaseSchema.partial().superRefine(validateMenuItemPrices);

export const mediaOrderSchema = z.object({
  displayOrder: z.number().int().min(0, 'displayOrder no puede ser negativo'),
});

export const registerEventSchema = z.object({
  itemId: z.number().int().positive('itemId inválido'),
  type: z.enum(['view', 'order_click']),
});

export const whatsappUpdateSchema = z.object({
  phoneNumber: z.string().min(1).optional(),
  messageTemplateEs: z.string().min(1).optional(),
  messageTemplateEn: z.string().min(1).optional(),
});

/** La `key` de una colección no se valida acá: es inmutable y va por la URL (ver routes/collections.ts). */
export const updateCollectionSchema = z.object({
  titleEs: z.string().min(1, 'titleEs requerido').optional(),
  titleEn: z.string().optional(),
  isActive: z.boolean().optional(),
});

const COLLECTION_ITEMS_MAX = 20;

const collectionItemInputSchema = z.object({
  itemId: z.number().int().positive('itemId inválido'),
  displayOrder: z.number().int().min(0).optional(),
});

export const replaceCollectionItemsSchema = z.object({
  items: z
    .array(collectionItemInputSchema)
    .max(COLLECTION_ITEMS_MAX, `una colección admite como máximo ${COLLECTION_ITEMS_MAX} ítems`),
}).superRefine((data, ctx) => {
  const seen = new Set<number>();
  data.items.forEach((entry, index) => {
    if (seen.has(entry.itemId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items', index, 'itemId'],
        message: 'itemId duplicado en items',
      });
    }
    seen.add(entry.itemId);
  });
});
