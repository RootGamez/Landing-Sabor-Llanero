/**
 * Del resultado del parser a lo que se envía a la API: filas clasificadas, con
 * su hash de idempotencia, texto saneado y validadas con el mismo esquema que
 * aplica el servidor. Puro y sin DOM: lo usan la UI y el smoke local.
 */
import { classifyRows } from './classify';
import { importHashes } from './hash';
import {
  HOMEBANK_DESCRIPTION_MAX,
  HOMEBANK_IMPORT_BATCH_SIZE,
  homebankExpenseRowSchema,
  homebankIncomeRowSchema,
  type HomebankExpenseRowInput,
  type HomebankIncomeRowInput,
} from './importSchemas';
import type { HomebankRow } from './types';
import { UNSAFE_TEXT } from '../validation';

const UNSAFE_TEXT_GLOBAL = new RegExp(UNSAFE_TEXT.source, 'g');

export interface HomebankRejectedRow {
  /** Posición 1-based dentro de las filas válidas del archivo. */
  index: number;
  message: string;
}

export interface PreparedHomebankImport {
  expenses: HomebankExpenseRowInput[];
  incomes: HomebankIncomeRowInput[];
  /** Filas con monto 0, descartadas por el clasificador. */
  ignored: number;
  /** Filas que no pasan el esquema del servidor (no se envían). */
  rejected: HomebankRejectedRow[];
  expensesTotalCents: number;
  incomesTotalCents: number;
  /** Primera y última fecha entre gastos e ingresos; `null` si no hay filas. */
  dateRange: { from: string; to: string } | null;
}

export interface HomebankBatch {
  expenses: HomebankExpenseRowInput[];
  incomes: HomebankIncomeRowInput[];
}

/** Caracteres de control/invisibles → espacio, espacios colapsados: el servidor los rechaza tal cual. */
export function sanitizeHomebankText(value: string): string {
  return value.replace(UNSAFE_TEXT_GLOBAL, ' ').replace(/\s+/g, ' ').trim();
}

const sum = (rows: ReadonlyArray<{ amountCents: number }>): number =>
  rows.reduce((total, row) => total + row.amountCents, 0);

function dateRangeOf(dates: readonly string[]): { from: string; to: string } | null {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  return { from: sorted[0]!, to: sorted[sorted.length - 1]! };
}

/** Clasifica, hashea (repeticiones idénticas del archivo llevan `#n`), sanea y valida. */
export async function prepareHomebankImport(rows: readonly HomebankRow[]): Promise<PreparedHomebankImport> {
  const hashes = await importHashes(rows);
  const expenses: HomebankExpenseRowInput[] = [];
  const incomes: HomebankIncomeRowInput[] = [];
  const rejected: HomebankRejectedRow[] = [];
  let ignored = 0;

  rows.forEach((row, position) => {
    const hash = hashes[position]!;
    const classified = classifyRows([row]);
    ignored += classified.ignored;
    const expense = classified.expenses[0];
    const income = classified.incomes[0];
    if (expense !== undefined) {
      const candidate = {
        ...expense,
        category: sanitizeHomebankText(expense.category),
        description: sanitizeHomebankText(expense.description).slice(0, HOMEBANK_DESCRIPTION_MAX).trim(),
        hash,
      };
      const parsed = homebankExpenseRowSchema.safeParse(candidate);
      if (parsed.success) expenses.push(parsed.data);
      else rejected.push({ index: position + 1, message: parsed.error.issues[0]?.message ?? 'fila inválida' });
    } else if (income !== undefined) {
      const parsed = homebankIncomeRowSchema.safeParse({ ...income, hash });
      if (parsed.success) incomes.push(parsed.data);
      else rejected.push({ index: position + 1, message: parsed.error.issues[0]?.message ?? 'fila inválida' });
    }
  });

  return {
    expenses,
    incomes,
    ignored,
    rejected,
    expensesTotalCents: sum(expenses),
    incomesTotalCents: sum(incomes),
    dateRange: dateRangeOf([...expenses.map((r) => r.date), ...incomes.map((r) => r.date)]),
  };
}

/** Lotes de a lo sumo `size` filas en total (gastos primero, luego ingresos). */
export function chunkHomebankImport(
  expenses: readonly HomebankExpenseRowInput[],
  incomes: readonly HomebankIncomeRowInput[],
  size: number = HOMEBANK_IMPORT_BATCH_SIZE,
): HomebankBatch[] {
  const batches: HomebankBatch[] = [];
  const total = expenses.length + incomes.length;
  for (let start = 0; start < total; start += size) {
    const end = Math.min(start + size, total);
    batches.push({
      expenses: expenses.slice(Math.min(start, expenses.length), Math.min(end, expenses.length)),
      incomes: incomes.slice(Math.max(start - expenses.length, 0), Math.max(end - expenses.length, 0)),
    });
  }
  return batches;
}
