/**
 * Resumen de egresos de un período: contrato de `GET /api/expenses/summary`,
 * texto para WhatsApp y búsqueda de categorías por nombre (sin mayúsculas ni
 * acentos). Vive en `shared` para probarse sin navegador ni base de datos.
 */
import { BRAND } from './brand';
import { formatPEN } from './money';

export interface ExpenseSummaryCategory {
  /** Categoría raíz: las subcategorías se suman en su padre. */
  categoryId: number;
  name: string;
  color: string | null;
  totalCents: number;
  count: number;
}

export interface ExpenseSummaryItem {
  id: number;
  /** Día local de Lima, YYYY-MM-DD. */
  date: string;
  description: string;
  categoryName: string;
  amountCents: number;
}

export interface ExpenseSummary {
  count: number;
  totalCents: number;
  /** De mayor a menor total. */
  byCategory: ExpenseSummaryCategory[];
  /** Los más recientes del filtro (tope pedido en `limit`). */
  items: ExpenseSummaryItem[];
  /** Cuántos gastos del filtro no vienen en `items`. */
  moreCount: number;
}

export interface ExpenseSummaryTextOptions {
  /** "Domingo 22 de noviembre de 2026" o "15/11 al 22/11". */
  periodLabel: string;
  /** Con un rango de varios días, cada gasto lleva su fecha corta. */
  showDates: boolean;
}

/** Minúsculas, sin acentos y con espacios colapsados: la clave para comparar nombres. */
export function normalizeLabel(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** La categoría cuyo nombre coincide exactamente (ignorando mayúsculas y acentos), si existe. */
export function findCategoryByName<T extends { name: string }>(options: readonly T[], text: string): T | undefined {
  const key = normalizeLabel(text);
  if (key === '') return undefined;
  return options.find((option) => normalizeLabel(option.name) === key);
}

function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** "2026-11-21" → "21/11". */
function shortDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

function itemLine(item: ExpenseSummaryItem, showDates: boolean): string {
  const label = item.description.trim() || item.categoryName;
  const prefix = showDates ? `${shortDate(item.date)} · ` : '';
  return `• ${prefix}${label} — ${formatPEN(item.amountCents)}`;
}

/** Resumen de egresos para pegar en WhatsApp (negritas con `*`). */
export function buildExpenseSummaryText(summary: ExpenseSummary, options: ExpenseSummaryTextOptions): string {
  const lines = [`*Egresos — ${BRAND.name}*`, options.periodLabel, ''];
  if (summary.count === 0) return [...lines, 'Sin gastos en este período.'].join('\n');
  lines.push(
    `*Total de egresos: ${formatPEN(summary.totalCents)}*`,
    `${summary.count} ${summary.count === 1 ? 'gasto' : 'gastos'}`,
    '',
    '*Por categoría*',
    ...summary.byCategory.map((c) => `• ${c.name}: ${formatPEN(c.totalCents)} (${percent(c.totalCents, summary.totalCents)}%)`),
    '',
    '*Gastos*',
    ...summary.items.map((item) => itemLine(item, options.showDates)),
  );
  if (summary.moreCount > 0) lines.push(`+${summary.moreCount} más`);
  return lines.join('\n');
}
