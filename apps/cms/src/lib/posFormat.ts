import type { Sale, SaleItem } from '@sabor/shared';

/** Hora local ("03:45 p. m.") de un timestamp UTC de D1 ("YYYY-MM-DD HH:MM:SS"). */
export function formatClock(sqliteUtc: string): string {
  const date = new Date(`${sqliteUtc.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return sqliteUtc;
  return new Intl.DateTimeFormat('es-PE', { timeStyle: 'short' }).format(date);
}

/** "2× Pizza Pepperoni (Grande), 1× Gaseosa" */
export function summarizeItems(items: readonly Pick<SaleItem, 'name' | 'sizeLabel' | 'quantity'>[]): string {
  return items
    .map((item) => `${item.quantity}× ${item.name}${item.sizeLabel ? ` (${item.sizeLabel})` : ''}`)
    .join(', ');
}

export function isVoided(sale: Pick<Sale, 'voidedAt'>): boolean {
  return sale.voidedAt !== null;
}
