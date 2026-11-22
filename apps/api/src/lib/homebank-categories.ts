import {
  isCreatableHomebankCategory,
  splitHomebankCategory,
  type HomebankCategoryMapValue,
  type HomebankCategoryPreview,
} from '@sabor/shared';
import type { ExpenseCategoryRow } from '../db/rows';
import { badRequest } from './http-error';

export type CategoryRef = Pick<ExpenseCategoryRow, 'id' | 'name' | 'parent_id' | 'is_active'>;

/** Mismo criterio que el índice único de categorías (sin distinguir mayúsculas). */
const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

export async function loadCategories(db: D1Database): Promise<CategoryRef[]> {
  const { results } = await db
    .prepare('SELECT id, name, parent_id, is_active FROM expense_categories')
    .all<CategoryRef>();
  return results;
}

function findRoot(all: readonly CategoryRef[], name: string): CategoryRef | undefined {
  return all.find((c) => c.parent_id === null && sameName(c.name, name));
}

/** Categoría existente para "Padre" o "Padre:Hija" (id), o `null` si no existe. Nunca escribe. */
export function findCategoryId(all: readonly CategoryRef[], name: string): number | null {
  const { parent, child } = splitHomebankCategory(name);
  const root = parent === '' ? undefined : findRoot(all, parent);
  if (root === undefined) return null;
  if (child === null) return root.id;
  return all.find((c) => c.parent_id === root.id && sameName(c.name, child))?.id ?? null;
}

/** Cuenta gastos por categoría del archivo y resuelve cuáles ya existen. */
export function previewCategories(
  all: readonly CategoryRef[],
  names: readonly string[],
): HomebankCategoryPreview[] {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, categoryId: findCategoryId(all, name), count }));
}

function isUsable(all: readonly CategoryRef[], id: number): boolean {
  const category = all.find((c) => c.id === id);
  if (category === undefined || !category.is_active) return false;
  if (category.parent_id === null) return true;
  return all.find((c) => c.id === category.parent_id)?.is_active === 1;
}

/** Valida TODO el mapeo antes de escribir nada: entrada faltante, id inexistente/inactivo o nombre no creable. */
export function assertValidCategoryMap(
  all: readonly CategoryRef[],
  usedNames: readonly string[],
  map: ReadonlyMap<string, HomebankCategoryMapValue>,
): void {
  for (const name of new Set(usedNames)) {
    const label = name === '' ? '(sin categoría)' : name;
    const target = map.get(name);
    if (target === undefined) throw badRequest(`Falta asignar la categoría "${label}"`);
    if (target === 'create') {
      if (!isCreatableHomebankCategory(name)) {
        throw badRequest(
          `La categoría "${label}" no se puede crear (vacía o de más de 60 caracteres): asígnala a una existente`,
        );
      }
    } else if (!isUsable(all, target)) {
      throw badRequest(`La categoría elegida para "${label}" no existe o está desactivada`);
    }
  }
}

async function insertCategory(db: D1Database, name: string, parentId: number | null): Promise<CategoryRef> {
  const row = await db
    .prepare('INSERT INTO expense_categories (name, parent_id) VALUES (?, ?) RETURNING id, name, parent_id, is_active')
    .bind(name, parentId)
    .first<CategoryRef>();
  if (!row) throw new Error('no se pudo crear la categoría');
  return row;
}

/**
 * Resuelve cada categoría usada a un id, creando las marcadas 'create' (y su
 * padre) solo si no existen: el siguiente lote o una reimportación reutiliza
 * lo ya creado. Llamar solo tras `assertValidCategoryMap`.
 */
export async function resolveCategoryIds(
  db: D1Database,
  all: readonly CategoryRef[],
  usedNames: readonly string[],
  map: ReadonlyMap<string, HomebankCategoryMapValue>,
): Promise<Map<string, number>> {
  const known: CategoryRef[] = [...all];
  const resolved = new Map<string, number>();
  for (const name of new Set(usedNames)) {
    const target = map.get(name);
    if (target === undefined) throw badRequest('Falta asignar una categoría');
    if (target !== 'create') {
      resolved.set(name, target);
      continue;
    }
    const existing = findCategoryId(known, name);
    if (existing !== null) {
      resolved.set(name, existing);
      continue;
    }
    const { parent, child } = splitHomebankCategory(name);
    let root = findRoot(known, parent);
    if (root === undefined) {
      root = await insertCategory(db, parent, null);
      known.push(root);
    }
    if (child === null) {
      resolved.set(name, root.id);
      continue;
    }
    const created = await insertCategory(db, child, root.id);
    known.push(created);
    resolved.set(name, created.id);
  }
  return resolved;
}
