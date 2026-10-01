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
import { EMAIL_MAX, FULL_NAME_MAX, PASSWORD_MAX, PASSWORD_MIN, PHONE_MAX } from './forms';


const slugRegex = /^(?=.*[a-z])[a-z0-9]+(?:-[a-z0-9]+)*$/;


const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `la contraseña debe tener al menos ${PASSWORD_MIN} caracteres`)
  .max(PASSWORD_MAX, `la contraseña no puede superar ${PASSWORD_MAX} caracteres`);

const emailSchema = z.string().email('email inválido').max(EMAIL_MAX, 'email inválido');
// Sin caracteres de control ni de dirección de texto (RLO/LRO, etc.): evita nombres que se vean distinto de lo guardado.
const UNSAFE_TEXT = /[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/;
const nameSchema = z
  .string()
  .trim()
  .min(1, 'name requerido')
  .max(FULL_NAME_MAX, `name no puede superar ${FULL_NAME_MAX} caracteres`)
  .refine((value) => !UNSAFE_TEXT.test(value), 'name contiene caracteres no válidos');
const phoneSchema = z
  .string()
  .trim()
  .min(1, 'phone requerido')
  .max(PHONE_MAX, 'phone demasiado largo')
  .regex(/^\+?[0-9(][0-9\s().-]*$/, 'phone inválido');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'password requerido').max(PASSWORD_MAX, 'password inválido'),
});

export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  role: z.enum(['owner', 'admin']),
});

export const updateUserSchema = z.object({
  name: nameSchema.optional(),
  role: z.enum(['owner', 'admin']).optional(),
  password: passwordSchema.optional(),
});

/** Edición del perfil propio (cualquier rol): solo el nombre; email y rol los gestiona el owner. */
export const updateProfileSchema = z.object({
  name: nameSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'la contraseña actual es requerida').max(PASSWORD_MAX),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'la nueva contraseña debe ser distinta de la actual',
    path: ['newPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'token requerido').max(200, 'token inválido'),
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

export const customerRegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  phone: phoneSchema,
});

export const customerLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'password requerido').max(PASSWORD_MAX, 'password inválido'),
});

/** Edición del perfil propio del cliente: email y contraseña van por endpoints separados. */
export const updateCustomerProfileSchema = z.object({
  name: nameSchema.optional(),
  phone: phoneSchema.optional(),
});

const orderItemInputSchema = z.object({
  itemId: z.number().int().positive('itemId inválido'),
  sizeId: z.number().int().positive('sizeId inválido').optional(),
  quantity: z.number().int().positive('quantity debe ser mayor a 0'),
});

export const ORDER_ITEMS_MAX = 50;

const orderItemsArraySchema = z
  .array(orderItemInputSchema)
  .min(1, 'el pedido necesita al menos un ítem')
  .max(ORDER_ITEMS_MAX, `un pedido admite como máximo ${ORDER_ITEMS_MAX} ítems`)
  // Misma idea que replaceCollectionItemsSchema: sin esto, un body armado a
  // mano (fuera del carrito/editor, que ya dedupean) podría persistir dos
  // líneas para el mismo itemId+sizeId — el editor de pedidos del CMS las
  // trata como una sola fila (misma key), así que tocar una tocaría ambas.
  .superRefine((items, ctx) => {
    const seen = new Set<string>();
    items.forEach((entry, index) => {
      const key = `${entry.itemId}:${entry.sizeId ?? 'none'}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'itemId'],
          message: 'itemId (con el mismo sizeId) duplicado en items',
        });
      }
      seen.add(key);
    });
  });

export const createOrderSchema = z.object({
  items: orderItemsArraySchema,
});

/** Transición de estado desde el CMS: `pending` es solo el estado inicial, nunca un destino. */
export const orderStatusUpdateSchema = z.object({
  status: z.enum(['confirmed', 'cancelled']),
});

/** Reemplazo completo de ítems de un pedido `pending` (CMS, P2.9) — misma forma que `createOrderSchema`. */
export const updateOrderItemsSchema = z.object({
  items: orderItemsArraySchema,
});

const rewardBaseSchema = z.object({
  nameEs: z.string().min(1, 'nameEs requerido'),
  nameEn: z.string().default(''),
  descriptionEs: z.string().default(''),
  descriptionEn: z.string().default(''),
  pointsCost: z.number().int().positive('pointsCost debe ser mayor a 0'),
  price: z.number().positive('price debe ser mayor a 0'),
  discountPrice: z.number().positive('discountPrice debe ser mayor a 0').nullable().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

interface RewardPriceShape {
  price?: number;
  discountPrice?: number | null;
}

/**
 * discountPrice < price: solo se puede validar acá cuando AMBOS valores
 * llegan en el mismo request. Un PATCH que manda solo discountPrice (sin
 * price) necesita el price ACTUAL de la fila, que este paquete no puede leer
 * (sin acceso a D1) — esa combinación la revalida routes/rewards.ts contra la
 * DB antes de escribir.
 */
function validateRewardDiscount(data: RewardPriceShape, ctx: z.RefinementCtx): void {
  if (data.discountPrice != null && data.price != null && data.discountPrice >= data.price) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discountPrice'],
      message: 'discountPrice debe ser menor a price',
    });
  }
}

export const createRewardSchema = rewardBaseSchema.superRefine(validateRewardDiscount);
export const updateRewardSchema = rewardBaseSchema.partial().superRefine(validateRewardDiscount);

export const loyaltyConfigUpdateSchema = z.object({
  pointsPerCurrencyUnit: z.number().positive('pointsPerCurrencyUnit debe ser mayor a 0').optional(),
  minOrderAmountForPoints: z.number().min(0).optional(),
});

const periodRegex = /^\d{4}-\d{2}$/;

/** Si se omite `period`, la API sortea/lista el mes calendario actual. */
export const drawRaffleSchema = z.object({
  period: z.string().regex(periodRegex, 'formato inválido, se espera YYYY-MM').optional(),
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
