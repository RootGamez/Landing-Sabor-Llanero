import { foldForCompare } from './text';
import type { HomebankPaymentMethod, HomebankRow } from './types';

/** Marca que HomeBank pone en `wording` de operaciones autogeneradas: no aporta información. */
const AUTO_IMPORT_MARKER = 'importacion automatica';
const DESCRIPTION_SEPARATOR = ' — ';

export interface HomebankExpense {
  date: string;
  /** Céntimos positivos. */
  amountCents: number;
  category: string;
  description: string;
  paymentMethod: HomebankPaymentMethod;
}

/** Ingreso de HomeBank = total de ventas del día (sin detalle de producto). */
export interface HomebankIncome {
  date: string;
  amountCents: number;
}

export interface ClassifiedRows {
  expenses: HomebankExpense[];
  incomes: HomebankIncome[];
  /** Filas con monto 0, descartadas. */
  ignored: number;
}

function buildDescription(row: HomebankRow): string {
  return [row.payee, row.memo]
    .filter((part) => part !== '' && foldForCompare(part) !== AUTO_IMPORT_MARKER)
    .join(DESCRIPTION_SEPARATOR);
}

/** Separa en egresos (negativos), ingresos (positivos) e ignorados (cero). No muta la entrada. */
export function classifyRows(rows: readonly HomebankRow[]): ClassifiedRows {
  const expenses: HomebankExpense[] = [];
  const incomes: HomebankIncome[] = [];
  let ignored = 0;
  for (const row of rows) {
    if (row.amountCents < 0) {
      expenses.push({
        date: row.date,
        amountCents: -row.amountCents,
        category: row.category,
        description: buildDescription(row),
        paymentMethod: row.paymentMethod,
      });
    } else if (row.amountCents > 0) {
      incomes.push({ date: row.date, amountCents: row.amountCents });
    } else {
      ignored += 1;
    }
  }
  return { expenses, incomes, ignored };
}
