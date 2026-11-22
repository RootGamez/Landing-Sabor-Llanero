/**
 * Back-office (Plan Parte 3): esquemas Zod de request + DTOs de respuesta de
 * caja, ventas y gastos. Mismo estilo que `validation.ts`: mensajes en
 * español y UNSAFE_TEXT en textos libres. Todo monto va en céntimos enteros
 * (D1). Los precios y totales NUNCA vienen del cliente: `createSaleSchema`
 * solo acepta ids + cantidades y el servidor recalcula (D6, F3).
 */
import { z } from 'zod';
import { isValidLocalDate } from './localDate';
import { MAX_CENTS } from './money';
import type { OrderDto } from './dto';
import { ORDER_ITEMS_MAX, UNSAFE_TEXT } from './validation';

// ── Primitivas ──────────────────────────────────────────────────────────────

const NOTES_MAX = 300;
const REASON_MAX = 200;
const DESCRIPTION_MAX = 200;
const CATEGORY_NAME_MAX = 60;
const SALE_QUANTITY_MAX = 99;

/** Claves de `payment_methods` (efectivo, yape, ...): minúsculas/guion bajo. La existencia real la valida la API contra la tabla. */
const paymentMethodKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,31}$/, 'método de pago inválido');

/** Céntimos enteros ≥ 0, con tope sanitario (MAX_CENTS). */
const centsSchema = z
  .number()
  .int('el monto debe estar en céntimos enteros')
  .min(0, 'el monto no puede ser negativo')
  .max(MAX_CENTS, 'el monto supera el máximo permitido');

const positiveCentsSchema = centsSchema.min(1, 'el monto debe ser mayor a 0');

const safeText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} no puede superar ${max} caracteres`)
    .refine((value) => !UNSAFE_TEXT.test(value), `${label} contiene caracteres no válidos`);

const requiredSafeText = (max: number, label: string) =>
  safeText(max, label).refine((value) => value.length > 0, `${label} requerido`);

const localDateSchema = z
  .string()
  .refine(isValidLocalDate, 'fecha inválida, se espera YYYY-MM-DD');

// ── Caja ────────────────────────────────────────────────────────────────────

export const openSessionSchema = z.object({
  openingCashCents: centsSchema,
  notes: safeText(NOTES_MAX, 'notes').default(''),
});

export const closeSessionSchema = z.object({
  countedCashCents: centsSchema,
  notes: safeText(NOTES_MAX, 'notes').default(''),
});

// ── Ventas ──────────────────────────────────────────────────────────────────

const saleItemInputSchema = z.object({
  itemId: z.number().int().positive('itemId inválido'),
  sizeId: z.number().int().positive('sizeId inválido').optional(),
  quantity: z
    .number()
    .int('quantity debe ser entero')
    .min(1, 'quantity debe ser mayor a 0')
    .max(SALE_QUANTITY_MAX, `quantity no puede superar ${SALE_QUANTITY_MAX}`),
});

const saleItemsSchema = z
  .array(saleItemInputSchema)
  .min(1, 'la venta necesita al menos un ítem')
  .max(ORDER_ITEMS_MAX, `una venta admite como máximo ${ORDER_ITEMS_MAX} ítems`)
  .superRefine((items, ctx) => {
    const seen = new Set<string>();
    items.forEach((entry, index) => {
      const key = `${entry.itemId}:${entry.sizeId ?? 'none'}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'itemId'],
          message: 'itemId (con el mismo sizeId) duplicado en items',
        });
      }
      seen.add(key);
    });
  });

export const createSaleSchema = z
  .object({
    /** UUID generado en el cliente: idempotencia ante reintentos (UNIQUE en DB) y base del modo offline (D13). */
    clientUuid: z.uuid('clientUuid inválido'),
    /** Opcional solo al cobrar un pedido web (`orderId`): entonces las líneas salen del pedido y se ignora esta lista. */
    items: saleItemsSchema.optional(),
    paymentMethod: paymentMethodKeySchema,
    discountCents: centsSchema.default(0),
    /** Solo efectivo: lo que entregó el cliente, para calcular el vuelto. */
    cashReceivedCents: centsSchema.optional(),
    /** "Cobrar pedido web" (D7): enlaza la venta con el pedido confirmado. */
    orderId: z.number().int().positive('orderId inválido').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.items === undefined && data.orderId === undefined) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'la venta necesita al menos un ítem' });
    }
  });

export const voidSaleSchema = z.object({
  reason: requiredSafeText(REASON_MAX, 'reason'),
});

// ── Gastos ──────────────────────────────────────────────────────────────────

export const expenseSchema = z.object({
  date: localDateSchema,
  amountCents: positiveCentsSchema,
  categoryId: z.number().int().positive('categoryId inválido'),
  description: safeText(DESCRIPTION_MAX, 'description').default(''),
  paymentMethod: paymentMethodKeySchema,
  /** Descuenta del efectivo esperado de la sesión abierta (D10). */
  paidFromRegister: z.boolean().default(false),
});

export const expenseCategorySchema = z.object({
  name: requiredSafeText(CATEGORY_NAME_MAX, 'name'),
  parentId: z.number().int().positive('parentId inválido').nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'color inválido, se espera #RRGGBB')
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});

export type OpenSessionInput = z.infer<typeof openSessionSchema>;
export type CloseSessionInput = z.infer<typeof closeSessionSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type VoidSaleInput = z.infer<typeof voidSaleSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;

// ── DTOs de respuesta (espejo de las tablas de 0009_backoffice.sql) ─────────

export type BackofficeSource = 'pos' | 'aronium' | 'homebank';
export type ExpenseSource = 'manual' | 'homebank';

export interface PaymentMethod {
  key: string;
  label: string;
  displayOrder: number;
  isActive: boolean;
}

export interface CashSession {
  id: number;
  openedAt: string;
  openedBy: number | null;
  openingCashCents: number;
  closedAt: string | null;
  closedBy: number | null;
  countedCashCents: number | null;
  expectedCashCents: number | null;
  notes: string;
  /** Foto del cierre (CashCloseSnapshot); null mientras la sesión está abierta. */
  closeSnapshot: CashCloseSnapshot | null;
  source: BackofficeSource;
}

export interface SaleItem {
  id: number;
  saleId: number;
  itemId: number | null;
  sizeId: number | null;
  name: string;
  sizeLabel: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface Sale {
  id: number;
  sessionId: number;
  /** Correlativo dentro de la sesión de caja. */
  number: number;
  createdAt: string;
  createdBy: number | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paymentMethod: string;
  cashReceivedCents: number | null;
  /** Vuelto calculado (cashReceived − total); null si no hubo efectivo recibido. */
  changeCents: number | null;
  orderId: number | null;
  clientUuid: string | null;
  voidedAt: string | null;
  voidedBy: number | null;
  voidReason: string | null;
  source: BackofficeSource;
  items: SaleItem[];
}

export interface ExpenseCategory {
  id: number;
  name: string;
  parentId: number | null;
  color: string | null;
  isActive: boolean;
}

export interface Expense {
  id: number;
  /** Día local de Lima, YYYY-MM-DD. */
  date: string;
  amountCents: number;
  categoryId: number;
  description: string;
  paymentMethod: string;
  paidFromRegister: boolean;
  sessionId: number | null;
  source: ExpenseSource;
  createdBy: number | null;
  createdAt: string;
}

export interface CashCloseMethodTotal {
  paymentMethod: string;
  label: string;
  salesCount: number;
  totalCents: number;
}

export interface CashCloseTopProduct {
  name: string;
  quantity: number;
  totalCents: number;
}

/** Resumen de una sesión (en vivo mientras está abierta; base del snapshot al cerrar). */
export interface CashSessionSummary {
  sessionId: number;
  openedAt: string;
  openingCashCents: number;
  /** Ventas no anuladas. */
  salesCount: number;
  voidedCount: number;
  totalSalesCents: number;
  byMethod: CashCloseMethodTotal[];
  /** Gastos pagados de caja (`paid_from_register`) de la sesión. */
  cashExpensesCents: number;
  /** apertura + ventas en efectivo − gastos de caja (nunca negativo). */
  expectedCashCents: number;
  topProducts: CashCloseTopProduct[];
}

/** Foto inmutable del cierre de caja: de acá se regenera la imagen PNG sin recalcular (F5). */
export interface CashCloseSnapshot extends CashSessionSummary {
  closedAt: string;
  countedCashCents: number;
  /** contado − esperado: negativo = faltante, positivo = sobrante. */
  differenceCents: number;
}

/** Sesión + su resumen (snapshot congelado si está cerrada, en vivo si está abierta). */
export interface CashSessionDetail extends CashSession {
  summary: CashSessionSummary;
}

/** Pedido web confirmado y aún sin cobrar en caja ("Cobrar pedido web"), con el total ya en céntimos. */
export interface PendingWebOrder extends OrderDto {
  totalCents: number;
}
