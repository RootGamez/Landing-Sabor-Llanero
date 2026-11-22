import { findCategoryByName } from '@sabor/shared';
import { ApiError } from '../../lib/api';
import { createExpenseCategory, fetchExpenseCategories, updateExpenseCategory } from '../../lib/expensesApi';
import { flattenCategories, type CategoryOption } from './expenseUtils';

/** Lo elegido en el selector de tipo: una categoría que ya existe o un nombre nuevo que se crea al guardar. */
export type CategorySelection = { kind: 'existing'; id: number } | { kind: 'new'; name: string };

export const CATEGORY_NAME_MAX = 60;
const HTTP_CONFLICT = 409;

/** Quita espacios de más: "  gas   natural " → "gas natural". */
export function cleanTypeName(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/** Lo escrito → selección: vacío = nada; coincide con una categoría = esa; si no, un tipo nuevo. */
export function selectionFromText(text: string, categories: readonly CategoryOption[]): CategorySelection | null {
  const name = cleanTypeName(text);
  if (name === '') return null;
  const match = findCategoryByName(categories, name);
  return match ? { kind: 'existing', id: match.id } : { kind: 'new', name };
}

export function selectionLabel(selection: CategorySelection | null, categories: readonly CategoryOption[]): string {
  if (!selection) return '';
  if (selection.kind === 'new') return selection.name;
  return categories.find((c) => c.id === selection.id)?.label ?? '';
}

async function idFromServer(name: string): Promise<number | undefined> {
  const fresh = flattenCategories(await fetchExpenseCategories());
  return findCategoryByName(fresh, name)?.id;
}

/**
 * Id de la categoría para guardar el gasto. Una existente se reutiliza (si estaba
 * desactivada se reactiva); una nueva se crea con `POST /expense-categories`. Si
 * otro dispositivo la creó mientras tanto (409), se busca la que ya existe.
 */
export async function ensureCategoryId(selection: CategorySelection, known: readonly CategoryOption[]): Promise<number> {
  if (selection.kind === 'existing') return selection.id;
  const name = cleanTypeName(selection.name);
  const existing = findCategoryByName(known, name);
  if (existing) {
    if (!existing.isActive) await updateExpenseCategory(existing.id, { isActive: true });
    return existing.id;
  }
  try {
    return (await createExpenseCategory({ name })).id;
  } catch (error) {
    if (error instanceof ApiError && error.status === HTTP_CONFLICT) {
      const id = await idFromServer(name);
      if (id !== undefined) return id;
    }
    throw error;
  }
}
