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
import {
  LINE_NOTE_MAX,
  MAX_FLAVORS_PER_PIZZA,
  MAX_PROMO_PIZZAS,
  cartLineIdentity,
  normalizeLineNote,
  type SaleItemFlavors,
} from './flavors';

// ── Primitivas ──────────────────────────────────────────────────────────────

const NOTES_MAX = 300;
const REASON_MAX = 200;
const DESCRIPTION_MAX = 200;
const CATEGORY_NAME_MAX = 60;
const SALE_QUANTITY_MAX = 99;

/** Método de pago que la API asigna cuando la venta no trae uno (D15). Es la clave del seed de `payment_methods`. */
export const DEFAULT_PAYMENT_METHOD = 'yape';

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

/**
 * Cierre de caja (D15): por defecto NO se cuadra. Con `reconcile=true` el
 * efectivo contado es obligatorio; sin cuadrar, no se admite (evita guardar un
 * conteo que nadie va a comparar).
 */
export const closeSessionSchema = z
  .object({
    reconcile: z.boolean().default(false),
    countedCashCents: centsSchema.optional(),
    notes: safeText(NOTES_MAX, 'notes').default(''),
  })
  .superRefine((data, ctx) => {
    if (data.reconcile && data.countedCashCents === undefined) {
      ctx.addIssue({ code: 'custom', path: ['countedCashCents'], message: 'cuenta el efectivo para cuadrar la caja' });
    }
    if (!data.reconcile && data.countedCashCents !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['countedCashCents'], message: 'countedCashCents solo aplica al cuadrar la caja' });
    }
  });

// ── Ventas ──────────────────────────────────────────────────────────────────

/**
 * Sabores elegidos: una lista de itemIds por pizza (pizza individual = 1
 * lista; promo = una por pizza incluida). Solo ids: el servidor valida que
 * existan, estén activos, sean pizzas y tengan precio en el tamaño, y tasa.
 */
export const lineFlavorsSchema = z
  .array(
    z
      .array(z.number().int().positive('sabor inválido'))
      .min(1, 'cada pizza necesita al menos un sabor')
      .max(MAX_FLAVORS_PER_PIZZA, `máximo ${MAX_FLAVORS_PER_PIZZA} sabores por pizza`),
  )
  .min(1, 'elige los sabores')
  .max(MAX_PROMO_PIZZAS, `máximo ${MAX_PROMO_PIZZAS} pizzas por línea`);

/** Nota libre por línea ("sin cebolla"): se valida el largo y se sanea (sin control/bidi); vacía → se omite. */
export const lineNoteSchema = z
  .string()
  .trim()
  .max(LINE_NOTE_MAX, `la nota no puede superar ${LINE_NOTE_MAX} caracteres`)
  .transform((value) => normalizeLineNote(value) ?? undefined);

const saleItemInputSchema = z.object({
  itemId: z.number().int().positive('itemId inválido'),
  sizeId: z.number().int().positive('sizeId inválido').optional(),
  quantity: z
    .number()
    .int('quantity debe ser entero')
    .min(1, 'quantity debe ser mayor a 0')
    .max(SALE_QUANTITY_MAX, `quantity no puede superar ${SALE_QUANTITY_MAX}`),
  flavors: lineFlavorsSchema.optional(),
  note: lineNoteSchema.optional(),
});

export const saleItemsSchema = z
  .array(saleItemInputSchema)
  .min(1, 'la venta necesita al menos un ítem')
  .max(ORDER_ITEMS_MAX, `una venta admite como máximo ${ORDER_ITEMS_MAX} ítems`)
  .superRefine((items, ctx) => {
    const seen = new Set<string>();
    items.forEach((entry, index) => {
      // Mismo producto con distintos sabores o nota = líneas distintas (no se fusionan).
      const key = cartLineIdentity(entry.itemId, entry.sizeId ?? null, entry.flavors ?? null, entry.note ?? null);
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'itemId'],
          message: 'línea duplicada en items (mismo producto, tamaño, sabores y nota)',
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
    /** Opcional: si falta, la API registra `DEFAULT_PAYMENT_METHOD` (Yape). */
    paymentMethod: paymentMethodKeySchema.optional(),
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

/** PATCH de gasto: todos los campos opcionales y sin defaults (un default pisaría el valor guardado). */
export const expenseUpdateSchema = z
  .object({
    date: localDateSchema,
    amountCents: positiveCentsSchema,
    categoryId: z.number().int().positive('categoryId inválido'),
    description: safeText(DESCRIPTION_MAX, 'description'),
    paymentMethod: paymentMethodKeySchema,
    paidFromRegister: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'no hay campos para actualizar');

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

/** PATCH de categoría de gasto: cualquier subconjunto de campos (al menos uno). */
export const expenseCategoryUpdateSchema = expenseCategorySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'no hay campos para actualizar');

export type OpenSessionInput = z.infer<typeof openSessionSchema>;
export type CloseSessionInput = z.infer<typeof closeSessionSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type VoidSaleInput = z.infer<typeof voidSaleSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;
export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;
export type ExpenseCategoryUpdateInput = z.infer<typeof expenseCategoryUpdateSchema>;

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
  /** Sabores elegidos y cómo se tasaron (null en ventas sin sabores e históricas). */
  flavors: SaleItemFlavors | null;
  /** Nota libre de la línea ("sin cebolla"); null si no hay. */
  note: string | null;
}

/** Mesa de origen de una venta cobrada desde una cuenta de mesa (para el comprobante). */
export interface SaleTable {
  tabId: number;
  tableLabel: string;
  /** Apertura de la cuenta, UTC "YYYY-MM-DD HH:MM:SS". */
  openedAt: string;
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
  /** Mesa de origen si se cobró una cuenta de mesa; null/ausente en mostrador y pedidos web. */
  table?: SaleTable | null;
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

/** Categoría con su uso (gastos no borrados) y sus hijas: el árbol de dos niveles de `GET /expense-categories`. */
export interface ExpenseCategoryNode extends ExpenseCategory {
  expenseCount: number;
  children: ExpenseCategoryNode[];
}

export interface ExpenseDayTotal {
  date: string;
  totalCents: number;
}

/** Página de gastos + total (en céntimos) de TODO el filtro y total diario de los días presentes en la página. */
export interface ExpenseListResult {
  items: Expense[];
  page: number;
  pageSize: number;
  total: number;
  totalCents: number;
  dayTotals: ExpenseDayTotal[];
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

/** Totales de una sesión, sin el efectivo esperado (lo único que un cierre sin cuadrar no guarda). */
export interface CashSessionTotals {
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
  topProducts: CashCloseTopProduct[];
}

/** Resumen de una sesión (en vivo mientras está abierta; base del snapshot al cerrar). */
export interface CashSessionSummary extends CashSessionTotals {
  /** apertura + ventas en efectivo − gastos de caja (nunca negativo). */
  expectedCashCents: number;
}

/** Cierre cuadrado (con conteo). Los snapshots viejos e importados no traen `reconciled`: valen como cuadrados. */
export interface ReconciledCloseSnapshot extends CashSessionSummary {
  reconciled?: true;
  closedAt: string;
  countedCashCents: number;
  /** contado − esperado: negativo = faltante, positivo = sobrante. */
  differenceCents: number;
}

/** Cierre sin cuadrar (D15): ventas, métodos, top, gastos de caja y anuladas, sin esperado/contado/diferencia. */
export interface UnreconciledCloseSnapshot extends CashSessionTotals {
  reconciled: false;
  closedAt: string;
}

/** Foto inmutable del cierre de caja: de acá se regenera la imagen PNG sin recalcular (F5). */
export type CashCloseSnapshot = ReconciledCloseSnapshot | UnreconciledCloseSnapshot;

export function isReconciledSnapshot(snapshot: CashCloseSnapshot): snapshot is ReconciledCloseSnapshot {
  return snapshot.reconciled !== false;
}

/** ¿El resumen trae efectivo esperado? Falso solo en el snapshot de una caja cerrada sin cuadrar. */
export function hasExpectedCash(summary: CashSessionSummary | UnreconciledCloseSnapshot): summary is CashSessionSummary {
  return 'expectedCashCents' in summary;
}

/** Sesión + su resumen (snapshot congelado si está cerrada, en vivo si está abierta). */
export interface CashSessionDetail extends CashSession {
  summary: CashSessionSummary | UnreconciledCloseSnapshot;
}

/** Pedido web confirmado y aún sin cobrar en caja ("Cobrar pedido web"), con el total ya en céntimos. */
export interface PendingWebOrder extends OrderDto {
  totalCents: number;
}
