import { describe, expect, it } from 'vitest';
import { buildExpenseSummaryText, findCategoryByName, normalizeLabel, type ExpenseSummary } from './expenseSummary';

const SUMMARY: ExpenseSummary = {
  count: 4,
  totalCents: 12_050,
  byCategory: [
    { categoryId: 1, name: 'Insumos', color: null, totalCents: 8_000, count: 2 },
    { categoryId: 2, name: 'Gas', color: '#ff0000', totalCents: 4_050, count: 2 },
  ],
  items: [
    { id: 4, date: '2026-11-22', description: 'Balón de gas', categoryName: 'Gas', amountCents: 4_000 },
    { id: 3, date: '2026-11-22', description: '', categoryName: 'Gas', amountCents: 50 },
    { id: 2, date: '2026-11-21', description: 'Queso mozzarella 5 kg', categoryName: 'Insumos', amountCents: 5_000 },
  ],
  moreCount: 1,
};

describe('normalizeLabel', () => {
  it('ignora mayúsculas, acentos y espacios repetidos', () => {
    expect(normalizeLabel('  Gás   Natural ')).toBe('gas natural');
    expect(normalizeLabel('ÑOQUIS')).toBe('noquis');
    expect(normalizeLabel('Pimentón')).toBe(normalizeLabel('pimenton'));
  });
});

describe('findCategoryByName', () => {
  const options = [
    { id: 1, name: 'Insumos' },
    { id: 2, name: 'Gás' },
  ];

  it('encuentra sin distinguir mayúsculas ni acentos', () => {
    expect(findCategoryByName(options, 'insumos')?.id).toBe(1);
    expect(findCategoryByName(options, ' GAS ')?.id).toBe(2);
  });

  it('devuelve undefined si no hay coincidencia exacta o el texto está vacío', () => {
    expect(findCategoryByName(options, 'Insu')).toBeUndefined();
    expect(findCategoryByName(options, '   ')).toBeUndefined();
  });
});

/** `Intl` separa "S/" y la cifra con un espacio duro: se normaliza para comparar. */
const plain = (text: string) => text.replace(/ /g, ' ');

describe('buildExpenseSummaryText', () => {
  it('arma el resumen para WhatsApp con total, categorías y gastos', () => {
    const text = plain(buildExpenseSummaryText(SUMMARY, { periodLabel: 'Domingo 22 de noviembre de 2026', showDates: false }));
    expect(text).toContain('*Egresos — Sabor Llanero*');
    expect(text).toContain('Domingo 22 de noviembre de 2026');
    expect(text).toContain('*Total de egresos: S/ 120.50*');
    expect(text).toContain('4 gastos');
    expect(text).toContain('• Insumos: S/ 80.00 (66%)');
    expect(text).toContain('• Gas: S/ 40.50 (34%)');
    expect(text).toContain('• Balón de gas — S/ 40.00');
    expect(text).toContain('• Gas — S/ 0.50');
    expect(text).toContain('+1 más');
  });

  it('con rango muestra la fecha corta de cada gasto', () => {
    const text = plain(buildExpenseSummaryText(SUMMARY, { periodLabel: '15/11 al 22/11', showDates: true }));
    expect(text).toContain('• 21/11 · Queso mozzarella 5 kg — S/ 50.00');
  });

  it('singular y sin gastos', () => {
    const one = buildExpenseSummaryText(
      { ...SUMMARY, count: 1, moreCount: 0, items: SUMMARY.items.slice(0, 1), byCategory: SUMMARY.byCategory.slice(0, 1) },
      { periodLabel: 'Hoy', showDates: false },
    );
    expect(one).toContain('1 gasto');
    expect(one).not.toContain('más');
    const none = buildExpenseSummaryText(
      { count: 0, totalCents: 0, byCategory: [], items: [], moreCount: 0 },
      { periodLabel: 'Hoy', showDates: false },
    );
    expect(none).toContain('Sin gastos');
  });
});
