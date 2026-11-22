import { evaluateAmountExpression, todayLocal, type Expense, type ExpenseCategoryNode, type ExpenseDayTotal } from '@sabor/shared';

const MS_PER_DAY = 86_400_000;
const QUICK_CATEGORY_COUNT = 6;

/** "12", "12,50" o una suma como "12+10+5" (soles) → céntimos; `null` si no es un monto válido mayor a 0. */
export function parseAmountToCents(text: string): number | null {
  const result = evaluateAmountExpression(text);
  return result.ok ? result.cents : null;
}

/** Motivo (en español) por el que el texto no es un monto válido; `null` si sí lo es. */
export function amountErrorMessage(text: string): string | null {
  const result = evaluateAmountExpression(text);
  return result.ok ? null : result.error;
}

/** Céntimos → texto editable ("12.50") para precargar el formulario de edición. */
export function centsToAmountText(cents: number): string {
  return (cents / 100).toFixed(2);
}

export interface CategoryOption {
  id: number;
  name: string;
  /** "Padre › Hija" para subcategorías. */
  label: string;
  color: string | null;
  isActive: boolean;
  expenseCount: number;
}

/** Aplana el árbol (padre primero, luego sus hijas) con la etiqueta completa de cada categoría. */
export function flattenCategories(tree: readonly ExpenseCategoryNode[]): CategoryOption[] {
  return tree.flatMap((root) => [
    toOption(root, root.name),
    ...root.children.map((child) => toOption(child, `${root.name} › ${child.name}`)),
  ]);
}

function toOption(node: ExpenseCategoryNode, label: string): CategoryOption {
  return {
    id: node.id,
    name: node.name,
    label,
    color: node.color,
    isActive: node.isActive,
    expenseCount: node.expenseCount,
  };
}

/** Las categorías activas más usadas (para los chips de registro rápido). */
export function topCategories(options: readonly CategoryOption[], limit = QUICK_CATEGORY_COUNT): CategoryOption[] {
  return options
    .filter((option) => option.isActive)
    .sort((a, b) => b.expenseCount - a.expenseCount || a.label.localeCompare(b.label, 'es'))
    .slice(0, limit);
}

export interface DayGroup {
  date: string;
  totalCents: number;
  items: Expense[];
}

/** Agrupa gastos ya ordenados por día; el total diario sale del servidor (cubre días partidos entre páginas). */
export function groupByDay(items: readonly Expense[], dayTotals: readonly ExpenseDayTotal[]): DayGroup[] {
  const totals = new Map(dayTotals.map((day) => [day.date, day.totalCents]));
  const groups: DayGroup[] = [];
  for (const expense of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === expense.date) {
      last.items.push(expense);
    } else {
      groups.push({ date: expense.date, totalCents: totals.get(expense.date) ?? 0, items: [expense] });
    }
  }
  return groups;
}

function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * MS_PER_DAY);
  return shifted.toISOString().slice(0, 10);
}

export interface RangePreset {
  key: 'today' | 'week' | 'month' | 'all';
  label: string;
}

export const RANGE_PRESETS: readonly RangePreset[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mes' },
  { key: 'all', label: 'Todo' },
];

/** Rango [from, to] en días locales de Lima ('' = sin límite). La semana empieza el lunes. */
export function presetRange(key: RangePreset['key'], today: string = todayLocal()): { from: string; to: string } {
  if (key === 'all') return { from: '', to: '' };
  if (key === 'today') return { from: today, to: today };
  if (key === 'month') return { from: `${today.slice(0, 8)}01`, to: today };
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  return { from: shiftDate(today, -((weekday + 6) % 7)), to: today };
}

/** Rótulo del día ("lun 10 mar 2026") a partir de 'YYYY-MM-DD'. */
export function formatDayHeading(date: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}
