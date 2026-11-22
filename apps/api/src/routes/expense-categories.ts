import { Hono } from 'hono';
import {
  expenseCategorySchema,
  expenseCategoryUpdateSchema,
  type ExpenseCategory,
  type ExpenseCategoryNode,
} from '@sabor/shared';
import type { AppEnv } from '../env';
import { mapExpenseCategory, type ExpenseCategoryRow } from '../db/rows';
import { badRequest, conflict, notFound } from '../lib/http-error';
import { requireIdParam } from '../lib/params';
import { parseBody } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';

/** Categorías de gastos (árbol de dos niveles): solo owner/admin. */
export const expenseCategoryRoutes = new Hono<AppEnv>();
expenseCategoryRoutes.use('*', requireAuth, requireRole('owner', 'admin'));

interface CategoryWithCount extends ExpenseCategoryRow {
  expense_count: number;
}

/** Arma el árbol raíz → hijas; una hija huérfana (padre inexistente) no puede darse por la FK. */
function buildTree(rows: readonly CategoryWithCount[]): ExpenseCategoryNode[] {
  const nodes = new Map<number, ExpenseCategoryNode>(
    rows.map((row) => [row.id, { ...mapExpenseCategory(row), expenseCount: row.expense_count, children: [] }]),
  );
  const roots: ExpenseCategoryNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id)!;
    const parent = row.parent_id === null ? undefined : nodes.get(row.parent_id);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

expenseCategoryRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ec.*, (SELECT COUNT(*) FROM expenses e WHERE e.category_id = ec.id AND e.deleted_at IS NULL) AS expense_count
       FROM expense_categories ec ORDER BY ec.name COLLATE NOCASE ASC, ec.id ASC`,
  ).all<CategoryWithCount>();
  return c.json(buildTree(results));
});

async function findCategory(db: D1Database, id: number): Promise<ExpenseCategoryRow> {
  const row = await db.prepare('SELECT * FROM expense_categories WHERE id = ?').bind(id).first<ExpenseCategoryRow>();
  if (!row) throw notFound('Categoría no encontrada');
  return row;
}

/** Máximo dos niveles: el padre debe ser raíz, y una categoría con hijas no puede volverse hija. */
async function assertValidParent(db: D1Database, parentId: number, selfId: number | null): Promise<void> {
  if (parentId === selfId) throw badRequest('Una categoría no puede ser su propia subcategoría');
  const parent = await db
    .prepare('SELECT * FROM expense_categories WHERE id = ?')
    .bind(parentId)
    .first<ExpenseCategoryRow>();
  if (!parent) throw badRequest('La categoría padre no existe');
  if (parent.parent_id !== null) throw badRequest('Solo se admiten dos niveles de categorías');
  if (selfId === null) return;
  const children = await db
    .prepare('SELECT COUNT(*) AS n FROM expense_categories WHERE parent_id = ?')
    .bind(selfId)
    .first<{ n: number }>();
  if ((children?.n ?? 0) > 0) throw badRequest('Una categoría con subcategorías no puede volverse subcategoría');
}

/** Nombre único (sin distinguir mayúsculas) dentro del mismo padre. */
async function assertNameFree(db: D1Database, name: string, parentId: number | null, selfId: number | null): Promise<void> {
  const clash = await db
    .prepare('SELECT id FROM expense_categories WHERE name = ?1 COLLATE NOCASE AND parent_id IS ?2 AND id IS NOT ?3')
    .bind(name, parentId, selfId)
    .first();
  if (clash) throw conflict('Ya existe una categoría con ese nombre');
}

expenseCategoryRoutes.post('/', async (c) => {
  const body = await parseBody(c, expenseCategorySchema);
  const db = c.env.DB;
  const parentId = body.parentId ?? null;
  if (parentId !== null) await assertValidParent(db, parentId, null);
  await assertNameFree(db, body.name, parentId, null);
  const row = await db
    .prepare('INSERT INTO expense_categories (name, parent_id, color, is_active) VALUES (?, ?, ?, ?) RETURNING *')
    .bind(body.name, parentId, body.color ?? null, body.isActive === false ? 0 : 1)
    .first<ExpenseCategoryRow>();
  return c.json(mapExpenseCategory(row!) satisfies ExpenseCategory, 201);
});

expenseCategoryRoutes.patch('/:id', async (c) => {
  const id = requireIdParam(c);
  const patch = await parseBody(c, expenseCategoryUpdateSchema);
  const db = c.env.DB;
  const current = await findCategory(db, id);

  const parentId = patch.parentId === undefined ? current.parent_id : patch.parentId;
  const name = patch.name ?? current.name;
  if (parentId !== null && parentId !== current.parent_id) await assertValidParent(db, parentId, id);
  if (name !== current.name || parentId !== current.parent_id) await assertNameFree(db, name, parentId, id);

  const updated = await db
    .prepare('UPDATE expense_categories SET name = ?, parent_id = ?, color = ?, is_active = ? WHERE id = ? RETURNING *')
    .bind(
      name,
      parentId,
      patch.color === undefined ? current.color : patch.color,
      patch.isActive === undefined ? current.is_active : patch.isActive ? 1 : 0,
      id,
    )
    .first<ExpenseCategoryRow>();
  return c.json(mapExpenseCategory(updated!) satisfies ExpenseCategory);
});

/** Solo si no tiene subcategorías ni gastos (ni siquiera eliminados: la FK es RESTRICT); si no, se desactiva. */
expenseCategoryRoutes.delete('/:id', async (c) => {
  const id = requireIdParam(c);
  const db = c.env.DB;
  await findCategory(db, id);
  const usage = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM expense_categories WHERE parent_id = ?1) AS children,
              (SELECT COUNT(*) FROM expenses WHERE category_id = ?1) AS expenses`,
    )
    .bind(id)
    .first<{ children: number; expenses: number }>();
  if ((usage?.children ?? 0) > 0) throw conflict('Tiene subcategorías: elimínalas o muévelas primero');
  if ((usage?.expenses ?? 0) > 0) {
    throw conflict('Tiene gastos asociados: desactívala en lugar de eliminarla');
  }
  // Atómico: si alguien creó un gasto o subcategoría entre el chequeo y el borrado, no borra.
  const removed = await db
    .prepare(
      `DELETE FROM expense_categories WHERE id = ?1
         AND NOT EXISTS (SELECT 1 FROM expense_categories WHERE parent_id = ?1)
         AND NOT EXISTS (SELECT 1 FROM expenses WHERE category_id = ?1)
       RETURNING id`,
    )
    .bind(id)
    .first();
  if (!removed) throw conflict('La categoría se usó mientras tanto: desactívala en lugar de eliminarla');
  return c.json({ id });
});
