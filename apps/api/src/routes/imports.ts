import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  homebankCommitSchema,
  homebankPreviewSchema,
  type HomebankCommitResult,
  type HomebankPreviewResult,
} from '@sabor/shared';
import type { AppEnv } from '../env';
import {
  assertValidCategoryMap,
  loadCategories,
  previewCategories,
  resolveCategoryIds,
} from '../lib/homebank-categories';
import {
  findExistingExpenseHashes,
  findExistingIncomeHashes,
  insertExpenses,
  insertIncomes,
  uniqueByHash,
} from '../lib/homebank-import';
import { parseBody } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';

/**
 * Importador HomeBank (F7): solo owner. El navegador parsea el archivo y manda
 * filas normalizadas; acá se revalidan con Zod y la escritura es idempotente
 * (`expenses.import_hash` / `sales.legacy_ref` UNIQUE, D11).
 */
export const importRoutes = new Hono<AppEnv>();
importRoutes.use('*', requireAuth, requireRole('owner'));
/** 500 filas ocupan ~0,5 MB: más que esto no es un lote legítimo (se corta antes de parsear el JSON). */
const MAX_BODY_BYTES = 1024 * 1024;
importRoutes.use(
  '*',
  bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: 'El lote es demasiado grande' }, 413) }),
);

importRoutes.post('/homebank/preview', async (c) => {
  const body = await parseBody(c, homebankPreviewSchema);
  const db = c.env.DB;
  const [expenseHashes, incomeHashes, categories] = await Promise.all([
    findExistingExpenseHashes(db, body.expenses.map((r) => r.hash)),
    findExistingIncomeHashes(db, body.incomes.map((r) => r.hash)),
    loadCategories(db),
  ]);
  const result: HomebankPreviewResult = {
    expenses: {
      total: body.expenses.length,
      existing: body.expenses.filter((r) => expenseHashes.has(r.hash)).length,
    },
    incomes: {
      total: body.incomes.length,
      existing: body.incomes.filter((r) => incomeHashes.has(r.hash)).length,
    },
    categories: previewCategories(categories, body.expenses.map((r) => r.category)),
  };
  return c.json(result);
});

importRoutes.post('/homebank/commit', async (c) => {
  const body = await parseBody(c, homebankCommitSchema);
  const db = c.env.DB;
  const userId = c.get('user').id;
  // Object.entries → Map: ninguna clave del cliente ("__proto__", "constructor") toca un prototipo.
  const categoryMap = new Map(Object.entries(body.categoryMap));

  const usedNames = body.expenses.map((r) => r.category);
  const categories = await loadCategories(db);
  assertValidCategoryMap(categories, usedNames, categoryMap);
  const categoryIds = await resolveCategoryIds(db, categories, usedNames, categoryMap);

  const expenses = uniqueByHash(body.expenses).map((row) => ({ ...row, categoryId: categoryIds.get(row.category)! }));
  const expensesInserted = await insertExpenses(db, expenses, userId);
  const incomesInserted = await insertIncomes(db, body.incomes, userId);

  const result: HomebankCommitResult = {
    expenses: { inserted: expensesInserted, duplicates: body.expenses.length - expensesInserted },
    incomes: { inserted: incomesInserted, duplicates: body.incomes.length - incomesInserted },
  };
  return c.json(result);
});
