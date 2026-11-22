/**
 * Contrato del importador HomeBank (F7). El parseo corre en el navegador y el
 * Worker recibe filas ya normalizadas, pero NUNCA confía en el cliente: estos
 * esquemas se aplican en el servidor sobre cada request.
 */
import { z } from 'zod';
import { isValidLocalDate } from '../localDate';
import { MAX_CENTS } from '../money';
import { UNSAFE_TEXT } from '../validation';

/** Filas (gastos + ingresos) por request; el cliente envía en lotes de este tamaño. */
export const HOMEBANK_IMPORT_BATCH_SIZE = 500;
export const HOMEBANK_DESCRIPTION_MAX = 200;
export const HOMEBANK_CATEGORY_MAX = 121; // "Padre:Hija" con 60 + ':' + 60
const CATEGORY_PART_MAX = 60;

const safeText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} no puede superar ${max} caracteres`)
    .refine((value) => !UNSAFE_TEXT.test(value), `${label} contiene caracteres no válidos`);

/** Rango razonable: un archivo corrupto no debe sembrar gastos o ventas en años absurdos. */
const MIN_IMPORT_DATE = '2000-01-01';
const MAX_IMPORT_DATE = '2100-12-31';
const dateSchema = z
  .string()
  .refine(isValidLocalDate, 'fecha inválida, se espera YYYY-MM-DD')
  .refine((value) => value >= MIN_IMPORT_DATE && value <= MAX_IMPORT_DATE, 'fecha fuera del rango permitido (2000–2100)');

const positiveCents = z
  .number()
  .int('el monto debe estar en céntimos enteros')
  .min(1, 'el monto debe ser mayor a 0')
  .max(MAX_CENTS, 'el monto supera el máximo permitido');

/** SHA-256 hex (64) con sufijo opcional `#n` para repeticiones idénticas del mismo archivo. */
const hashSchema = z.string().regex(/^[0-9a-f]{64}(#\d{1,5})?$/, 'hash inválido');

const paymentMethodSchema = z.enum(['efectivo', 'tarjeta', 'transferencia', 'yape', 'plin']);

export const homebankExpenseRowSchema = z.object({
  date: dateSchema,
  amountCents: positiveCents,
  category: safeText(HOMEBANK_CATEGORY_MAX, 'category'),
  description: safeText(HOMEBANK_DESCRIPTION_MAX, 'description'),
  paymentMethod: paymentMethodSchema,
  hash: hashSchema,
});

export const homebankIncomeRowSchema = z.object({
  date: dateSchema,
  amountCents: positiveCents,
  hash: hashSchema,
});

const rowsBody = z
  .object({
    expenses: z.array(homebankExpenseRowSchema).max(HOMEBANK_IMPORT_BATCH_SIZE),
    incomes: z.array(homebankIncomeRowSchema).max(HOMEBANK_IMPORT_BATCH_SIZE),
  })
  .refine(
    (body) => body.expenses.length + body.incomes.length <= HOMEBANK_IMPORT_BATCH_SIZE,
    `máximo ${HOMEBANK_IMPORT_BATCH_SIZE} filas por request`,
  )
  .refine((body) => body.expenses.length + body.incomes.length > 0, 'no hay filas para importar');

export const homebankPreviewSchema = rowsBody;

/** `categoryId` existente, o `'create'` para crear la categoría (y su padre) con el nombre del archivo. */
export const categoryMapValueSchema = z.union([z.number().int().positive(), z.literal('create')]);

export const homebankCommitSchema = z
  .object({
    expenses: z.array(homebankExpenseRowSchema).max(HOMEBANK_IMPORT_BATCH_SIZE),
    incomes: z.array(homebankIncomeRowSchema).max(HOMEBANK_IMPORT_BATCH_SIZE),
    categoryMap: z.record(z.string().max(HOMEBANK_CATEGORY_MAX), categoryMapValueSchema),
  })
  .refine(
    (body) => body.expenses.length + body.incomes.length <= HOMEBANK_IMPORT_BATCH_SIZE,
    `máximo ${HOMEBANK_IMPORT_BATCH_SIZE} filas por request`,
  )
  .refine((body) => body.expenses.length + body.incomes.length > 0, 'no hay filas para importar')
  .refine((body) => Object.keys(body.categoryMap).length <= HOMEBANK_IMPORT_BATCH_SIZE, 'categoryMap demasiado grande');

export type HomebankPreviewRequest = z.infer<typeof homebankPreviewSchema>;
export type HomebankCommitRequest = z.infer<typeof homebankCommitSchema>;
export type HomebankCategoryMapValue = z.infer<typeof categoryMapValueSchema>;
export type HomebankExpenseRowInput = z.infer<typeof homebankExpenseRowSchema>;
export type HomebankIncomeRowInput = z.infer<typeof homebankIncomeRowSchema>;

export interface HomebankCategoryPreview {
  /** Nombre tal cual viene del archivo ("Padre:Hija" o ''). */
  name: string;
  /** Id de la categoría existente que coincide, o `null` si no existe. */
  categoryId: number | null;
  /** Gastos del request que usan esa categoría. */
  count: number;
}

export interface HomebankPreviewResult {
  expenses: { total: number; existing: number };
  incomes: { total: number; existing: number };
  categories: HomebankCategoryPreview[];
}

export interface HomebankCommitResult {
  expenses: { inserted: number; duplicates: number };
  incomes: { inserted: number; duplicates: number };
}

/** Separa "Padre:Hija" en sus partes recortadas (sin ':' → solo `parent`). */
export function splitHomebankCategory(name: string): { parent: string; child: string | null } {
  const index = name.indexOf(':');
  if (index < 0) return { parent: name.trim(), child: null };
  return { parent: name.slice(0, index).trim(), child: name.slice(index + 1).trim() };
}

/** `true` si todas las partes del nombre caben en una categoría de gastos (≤ 60 y no vacías). */
export function isCreatableHomebankCategory(name: string): boolean {
  const { parent, child } = splitHomebankCategory(name);
  const fits = (part: string) => part.length > 0 && part.length <= CATEGORY_PART_MAX;
  return fits(parent) && (child === null || (fits(child) && !child.includes(':')));
}
