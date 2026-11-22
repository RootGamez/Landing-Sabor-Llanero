import { describe, expect, it } from 'vitest';
import { buildPlan, formatQuantity, limaToUtc, mapPaymentMethod, toCents } from './transform';
import type { MapRow, RawData } from './types';

describe('toCents', () => {
  it('redondea bien los casos clásicos de coma flotante', () => {
    expect(toCents(1.005)).toBe(101);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(103853.5)).toBe(10385350);
    expect(toCents(12)).toBe(1200);
  });
});

describe('formatQuantity', () => {
  it('usa coma decimal y sin ceros sobrantes', () => {
    expect(formatQuantity(0.5)).toBe('0,5');
    expect(formatQuantity(1.5)).toBe('1,5');
    expect(formatQuantity(2)).toBe('2');
    expect(formatQuantity(0.333)).toBe('0,333');
  });
});

describe('limaToUtc', () => {
  it('suma 5 horas y cruza de día', () => {
    expect(limaToUtc('2025-04-22 22:32:10.2184')).toBe('2025-04-23 03:32:10');
    expect(limaToUtc('2024-12-31 20:00:00')).toBe('2025-01-01 01:00:00');
  });

  it('falla con formatos inesperados', () => {
    expect(() => limaToUtc('ayer')).toThrow();
  });
});

describe('mapPaymentMethod', () => {
  it('mapea los tipos de Aronium a las claves de payment_methods', () => {
    expect(mapPaymentMethod('Cash')).toBe('efectivo');
    expect(mapPaymentMethod('Credit Card')).toBe('tarjeta');
    expect(mapPaymentMethod('Debit Card')).toBe('tarjeta');
    expect(mapPaymentMethod('Raro')).toBeNull();
  });
});

function raw(overrides: Partial<RawData> = {}): RawData {
  return {
    products: [
      { id: 1, name: 'Americana', groupName: 'Pizzas Grandes' },
      { id: 2, name: 'Tequeños', groupName: 'Entradas' },
    ],
    documents: [
      { id: 10, dateCreated: '2025-04-01 20:00:00.5', total: 35, discount: 0 },
      { id: 11, dateCreated: '2025-04-01 21:00:00', total: 7.5, discount: 0 },
      { id: 12, dateCreated: '2025-04-02 19:00:00', total: 35, discount: 0 },
      { id: 13, dateCreated: '2025-04-02 19:30:00', total: 35, discount: 0 },
    ],
    items: [
      { documentId: 10, productId: 1, quantity: 1, price: 35, total: 35 },
      { documentId: 11, productId: 2, quantity: 1.5, price: 5, total: 7.5 },
      { documentId: 12, productId: 1, quantity: 1, price: 35, total: 35 },
      { documentId: 13, productId: 1, quantity: 1, price: 35, total: 35 },
    ],
    payments: [
      { documentId: 10, typeName: 'Cash', amount: 35 },
      { documentId: 11, typeName: 'Credit Card', amount: 7.5 },
      { documentId: 12, typeName: 'Cash', amount: 35 },
    ],
    zReports: [{ id: 5, number: 4, fromDocumentId: 10, toDocumentId: 12 }],
    ...overrides,
  };
}

const MAP: MapRow[] = [
  { legacyId: 1, legacyName: 'Americana', legacyGroup: 'Pizzas Grandes', itemId: 13, sizeKey: 'grande', status: 'auto' },
  { legacyId: 2, legacyName: 'Tequeños', legacyGroup: 'Entradas', itemId: null, sizeKey: null, status: 'unmatched' },
];

describe('buildPlan', () => {
  it('crea una sesión por ZReport y una sintética por día para lo huérfano', () => {
    const plan = buildPlan(raw(), MAP, {});
    expect(plan.sessions.map((s) => s.legacyRef)).toEqual(['aronium:z:5', 'aronium:day:2025-04-02']);
  });

  it('convierte horas a UTC y calcula apertura/cierre y efectivo esperado', () => {
    const [z] = buildPlan(raw(), MAP, {}).sessions;
    expect(z.openedAtUtc).toBe('2025-04-02 01:00:00');
    expect(z.closedAtUtc).toBe('2025-04-03 00:00:00');
    expect(z.cashCents).toBe(3500 + 3500);
  });

  it('numera las ventas dentro de la sesión', () => {
    const [z] = buildPlan(raw(), MAP, {}).sessions;
    expect(z.sales.map((s) => [s.legacyRef, s.number])).toEqual([
      ['aronium:doc:10', 1],
      ['aronium:doc:11', 2],
      ['aronium:doc:12', 3],
    ]);
  });

  it('convierte cantidades fraccionarias en quantity=1 con nombre anotado', () => {
    const sale = buildPlan(raw(), MAP, {}).sessions[0].sales[1];
    expect(sale.paymentMethod).toBe('tarjeta');
    expect(sale.items).toEqual([
      expect.objectContaining({ name: 'Tequeños (×1,5)', quantity: 1, unitPriceCents: 750, lineTotalCents: 750 }),
    ]);
  });

  it('usa el mapa para item y tamaño, y guarda el snapshot del nombre', () => {
    const [item] = buildPlan(raw(), MAP, {}).sessions[0].sales[0].items;
    expect(item).toEqual(
      expect.objectContaining({ itemId: 13, sizeKey: 'grande', sizeLabel: 'Grande', name: 'Americana', unitPriceCents: 3500 }),
    );
  });

  it('un documento sin pago va como efectivo', () => {
    const plan = buildPlan(raw(), MAP, {});
    expect(plan.sessions[1].sales[0].paymentMethod).toBe('efectivo');
  });

  it('totales del plan cuadran con la suma de ventas', () => {
    const plan = buildPlan(raw(), MAP, {});
    expect(plan.salesCount).toBe(4);
    expect(plan.itemsCount).toBe(4);
    expect(plan.totalCents).toBe(3500 + 750 + 3500 + 3500);
  });

  it('--from descarta días anteriores pero conserva la numeración de la sesión', () => {
    const plan = buildPlan(raw(), MAP, { from: '2025-04-02' });
    expect(plan.sessions.map((s) => s.legacyRef)).toEqual(['aronium:z:5', 'aronium:day:2025-04-02']);
    const [z] = plan.sessions;
    expect(z.sales.map((s) => [s.legacyRef, s.number])).toEqual([['aronium:doc:12', 3]]);
  });

  it('descarta líneas de S/ 0 y documentos sin líneas, avisando', () => {
    const data = raw({
      items: [
        { documentId: 10, productId: 1, quantity: 1, price: 35, total: 35 },
        { documentId: 10, productId: 2, quantity: 1, price: 0, total: 0 },
        { documentId: 12, productId: 1, quantity: 1, price: 35, total: 35 },
      ],
    });
    const plan = buildPlan(data, MAP, {});
    expect(plan.sessions[0].sales[0].items).toHaveLength(1);
    expect(plan.salesCount).toBe(2);
    expect(plan.warnings.join('\n')).toMatch(/doc 10.*S\/ 0/);
    expect(plan.warnings.join('\n')).toMatch(/doc 11.*sin líneas/);
  });

  it('un descuento de documento se refleja y mantiene total = subtotal - descuento', () => {
    const data = raw({
      documents: [{ id: 10, dateCreated: '2025-04-01 20:00:00', total: 30, discount: 5 }],
      items: [{ documentId: 10, productId: 1, quantity: 1, price: 35, total: 35 }],
      zReports: [],
    });
    const [sale] = buildPlan(data, MAP, {}).sessions[0].sales;
    expect([sale.subtotalCents, sale.discountCents, sale.totalCents]).toEqual([3500, 500, 3000]);
  });
});
