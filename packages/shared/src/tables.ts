/**
 * Mesas del local (POS "Mesas"): plano en grilla, cuentas abiertas por mesa y
 * su cobro. Esquemas Zod de request, DTOs de respuesta y la lógica pura del
 * plano (solapes, límites, hueco libre) compartida por la API y el CMS.
 *
 * Una cuenta de mesa (`dining_tabs`) NO es una venta: vive en su propia tabla
 * hasta que se cobra; recién ahí nace la fila en `sales`. Así ningún reporte,
 * cierre de caja ni total de ingresos ve consumo no cobrado.
 */
import { z } from 'zod';
import { MAX_CENTS } from './money';
import { saleItemsSchema } from './backoffice';
import type { SaleItemFlavors } from './flavors';
import { UNSAFE_TEXT } from './validation';

// ── Plano ───────────────────────────────────────────────────────────────────

/** Columnas fijas del plano: las posiciones se guardan en celdas, el CMS las escala a %. */
export const PLAN_COLS = 12;
/** Filas mínimas del plano (el dibujo original); crece si alguna mesa baja más. */
export const PLAN_MIN_ROWS = 8;
export const PLAN_MAX_ROWS = 16;
/** Tamaño máximo de una mesa, en celdas. */
export const TABLE_MAX_W = 6;
export const TABLE_MAX_H = 4;
export const TABLE_LABEL_MAX = 20;

export const TABLE_SHAPES = ['rect', 'round'] as const;
export type TableShape = (typeof TABLE_SHAPES)[number];

/** Rectángulo en celdas de la grilla (x/y = esquina superior izquierda, desde 0). */
export interface PlanRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectsOverlap(a: PlanRect, b: PlanRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** ¿Cabe dentro del plano (columnas fijas, filas hasta el máximo)? */
export function fitsInPlan(rect: PlanRect): boolean {
  return (
    Number.isInteger(rect.x) &&
    Number.isInteger(rect.y) &&
    Number.isInteger(rect.w) &&
    Number.isInteger(rect.h) &&
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.w >= 1 &&
    rect.h >= 1 &&
    rect.w <= TABLE_MAX_W &&
    rect.h <= TABLE_MAX_H &&
    rect.x + rect.w <= PLAN_COLS &&
    rect.y + rect.h <= PLAN_MAX_ROWS
  );
}

/** Primera mesa (de `others`, excluyendo `selfId`) que se pisa con `rect`, o `undefined`. */
export function findOverlap<T extends PlanRect & { id: number }>(
  rect: PlanRect,
  others: readonly T[],
  selfId?: number,
): T | undefined {
  return others.find((other) => other.id !== selfId && rectsOverlap(rect, other));
}

/** Filas visibles del plano: al menos las mínimas y suficientes para la mesa más baja. */
export function planRows(rects: readonly PlanRect[]): number {
  const bottom = rects.reduce((max, rect) => Math.max(max, rect.y + rect.h), 0);
  return Math.min(PLAN_MAX_ROWS, Math.max(PLAN_MIN_ROWS, bottom));
}

/** Primer hueco libre (de arriba a abajo, de izquierda a derecha) para una mesa de w×h, o `null` si no hay. */
export function findFreeSpot(w: number, h: number, others: readonly PlanRect[]): PlanRect | null {
  for (let y = 0; y + h <= PLAN_MAX_ROWS; y += 1) {
    for (let x = 0; x + w <= PLAN_COLS; x += 1) {
      const candidate = { x, y, w, h };
      if (fitsInPlan(candidate) && !others.some((other) => rectsOverlap(candidate, other))) return candidate;
    }
  }
  return null;
}

/** "3" → "Mesa 3"; una etiqueta con texto ("Barra") se muestra tal cual. */
export function tableDisplayName(label: string): string {
  return /^\d+$/.test(label.trim()) ? `Mesa ${label.trim()}` : label.trim();
}

// ── Esquemas de request ─────────────────────────────────────────────────────

const labelSchema = z
  .string()
  .trim()
  .min(1, 'label requerido')
  .max(TABLE_LABEL_MAX, `label no puede superar ${TABLE_LABEL_MAX} caracteres`)
  .refine((value) => !UNSAFE_TEXT.test(value), 'label contiene caracteres no válidos');

const cell = (max: number) => z.number().int('debe ser entero').min(0, 'no puede ser negativo').max(max);

const tableFields = {
  label: labelSchema,
  x: cell(PLAN_COLS - 1),
  y: cell(PLAN_MAX_ROWS - 1),
  w: z.number().int().min(1).max(TABLE_MAX_W),
  h: z.number().int().min(1).max(TABLE_MAX_H),
  shape: z.enum(TABLE_SHAPES),
  displayOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
};

export const diningTableCreateSchema = z.object({
  label: tableFields.label,
  x: tableFields.x,
  y: tableFields.y,
  w: tableFields.w,
  h: tableFields.h,
  shape: tableFields.shape.default('rect'),
  displayOrder: tableFields.displayOrder.optional(),
});

/** PATCH de mesa: cualquier subconjunto (al menos un campo). */
export const diningTableUpdateSchema = z
  .object(tableFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'no hay campos para actualizar');

/**
 * Guardar el pedido de una mesa: la lista COMPLETA deseada (id + tamaño +
 * cantidad, igual que una venta). `expectedVersion` = versión de la cuenta que
 * vio el cliente (`null` si la mesa estaba libre): si otra persona guardó en
 * el medio, la API responde 409 en vez de pisar su tanda.
 */
export const saveTabSchema = z.object({
  expectedVersion: z.number().int().min(0).nullable(),
  items: saleItemsSchema,
});

const centsSchema = z.number().int().min(0).max(MAX_CENTS);

/** Cerrar mesa = cobrar. Mismas reglas de pago que una venta de mostrador. */
export const closeTabSchema = z.object({
  tabId: z.number().int().positive('tabId inválido'),
  expectedVersion: z.number().int().min(0),
  paymentMethod: z
    .string()
    .regex(/^[a-z][a-z0-9_]{0,31}$/, 'método de pago inválido')
    .optional(),
  discountCents: centsSchema.default(0),
  cashReceivedCents: centsSchema.optional(),
});

export const voidTabSchema = z.object({
  tabId: z.number().int().positive('tabId inválido'),
  reason: z
    .string()
    .trim()
    .min(1, 'reason requerido')
    .max(200, 'reason no puede superar 200 caracteres')
    .refine((value) => !UNSAFE_TEXT.test(value), 'reason contiene caracteres no válidos'),
});

export type DiningTableCreateInput = z.infer<typeof diningTableCreateSchema>;
export type DiningTableUpdateInput = z.infer<typeof diningTableUpdateSchema>;
export type SaveTabInput = z.infer<typeof saveTabSchema>;
export type CloseTabInput = z.infer<typeof closeTabSchema>;
export type VoidTabInput = z.infer<typeof voidTabSchema>;

// ── DTOs ────────────────────────────────────────────────────────────────────

export type DiningTabStatus = 'open' | 'paid' | 'void';

export interface DiningTable extends PlanRect {
  id: number;
  label: string;
  shape: TableShape;
  displayOrder: number;
  isActive: boolean;
}

/** Resumen de la cuenta abierta que muestra el mapa. */
export interface DiningTabSummary {
  id: number;
  version: number;
  /** UTC "YYYY-MM-DD HH:MM:SS". */
  openedAt: string;
  updatedAt: string;
  totalCents: number;
  itemCount: number;
}

/** Mesa + su cuenta abierta (si la hay): una celda del mapa. */
export interface DiningTableStatus extends DiningTable {
  openTab: DiningTabSummary | null;
}

export interface DiningTabItem {
  id: number;
  itemId: number | null;
  sizeId: number | null;
  name: string;
  sizeLabel: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  /** Sabores tasados (0011); null/ausente si la línea no tiene. La API siempre los manda. */
  flavors?: SaleItemFlavors | null;
  /** Nota libre de la línea (0011); null/ausente si no hay. */
  note?: string | null;
}

export interface DiningTab extends DiningTabSummary {
  tableId: number;
  status: DiningTabStatus;
  openedBy: number | null;
  saleId: number | null;
  items: DiningTabItem[];
}
