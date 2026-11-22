import { describe, expect, it } from 'vitest';
import {
  closeSessionSchema,
  createSaleSchema,
  expenseCategorySchema,
  expenseSchema,
  openSessionSchema,
  voidSaleSchema,
} from './backoffice';
import { createUserSchema, updateUserSchema } from './validation';

const UUID = '3f0a1c52-7d4e-4b8a-9c11-2e5f6a7b8c9d';

const validSale = {
  clientUuid: UUID,
  items: [{ itemId: 1, sizeId: 2, quantity: 1 }],
  paymentMethod: 'efectivo',
};

describe('openSessionSchema', () => {
  it('acepta fondo inicial en céntimos y nota opcional', () => {
    expect(openSessionSchema.safeParse({ openingCashCents: 5000 }).success).toBe(true);
    expect(openSessionSchema.safeParse({ openingCashCents: 0, notes: 'turno noche' }).success).toBe(true);
  });

  it.each([-1, 10.5, '100', null])('rechaza openingCashCents %s', (value) => {
    expect(openSessionSchema.safeParse({ openingCashCents: value }).success).toBe(false);
  });

  it('rechaza notas con caracteres de control o de dirección de texto', () => {
    expect(openSessionSchema.safeParse({ openingCashCents: 0, notes: 'a‮b' }).success).toBe(false);
  });
});

describe('closeSessionSchema', () => {
  it('exige el efectivo contado', () => {
    expect(closeSessionSchema.safeParse({}).success).toBe(false);
    expect(closeSessionSchema.safeParse({ countedCashCents: 12050 }).success).toBe(true);
  });

  it('rechaza contado negativo', () => {
    expect(closeSessionSchema.safeParse({ countedCashCents: -1 }).success).toBe(false);
  });
});

describe('createSaleSchema', () => {
  it('acepta una venta mínima y aplica descuento 0 por defecto', () => {
    const parsed = createSaleSchema.parse(validSale);
    expect(parsed.discountCents).toBe(0);
  });

  it('acepta venta con vuelto y pedido web enlazado', () => {
    const result = createSaleSchema.safeParse({
      ...validSale,
      discountCents: 200,
      cashReceivedCents: 5000,
      orderId: 9,
    });
    expect(result.success).toBe(true);
  });

  it('exige clientUuid con formato UUID (idempotencia)', () => {
    expect(createSaleSchema.safeParse({ ...validSale, clientUuid: 'no-es-uuid' }).success).toBe(false);
  });

  it('exige al menos un ítem', () => {
    expect(createSaleSchema.safeParse({ ...validSale, items: [] }).success).toBe(false);
  });

  it('rechaza ítems duplicados (mismo itemId y sizeId)', () => {
    const items = [
      { itemId: 1, sizeId: 2, quantity: 1 },
      { itemId: 1, sizeId: 2, quantity: 3 },
    ];
    expect(createSaleSchema.safeParse({ ...validSale, items }).success).toBe(false);
  });

  it('permite el mismo ítem con tamaños distintos', () => {
    const items = [
      { itemId: 1, sizeId: 2, quantity: 1 },
      { itemId: 1, sizeId: 3, quantity: 1 },
    ];
    expect(createSaleSchema.safeParse({ ...validSale, items }).success).toBe(true);
  });

  it.each([0, -1, 1.5, 1000])('rechaza cantidad %s', (quantity) => {
    const items = [{ itemId: 1, quantity }];
    expect(createSaleSchema.safeParse({ ...validSale, items }).success).toBe(false);
  });

  it.each([-1, 0.5])('rechaza discountCents %s', (discountCents) => {
    expect(createSaleSchema.safeParse({ ...validSale, discountCents }).success).toBe(false);
  });

  it('rechaza método de pago con formato inválido', () => {
    expect(createSaleSchema.safeParse({ ...validSale, paymentMethod: 'Efectivo; DROP' }).success).toBe(false);
    expect(createSaleSchema.safeParse({ ...validSale, paymentMethod: '' }).success).toBe(false);
  });

  it('descarta totales o precios mandados por el cliente (nunca se confía en ellos)', () => {
    const parsed = createSaleSchema.parse({ ...validSale, totalCents: 1, unitPriceCents: 1 });
    expect(parsed).not.toHaveProperty('totalCents');
    expect(parsed).not.toHaveProperty('unitPriceCents');
  });
});

describe('voidSaleSchema', () => {
  it('exige un motivo no vacío', () => {
    expect(voidSaleSchema.safeParse({ reason: '   ' }).success).toBe(false);
    expect(voidSaleSchema.safeParse({}).success).toBe(false);
    expect(voidSaleSchema.safeParse({ reason: 'Se cobró dos veces' }).success).toBe(true);
  });
});

describe('expenseSchema', () => {
  const valid = { date: '2026-11-22', amountCents: 4500, categoryId: 1, paymentMethod: 'efectivo' };

  it('acepta un gasto válido y aplica defaults', () => {
    const parsed = expenseSchema.parse(valid);
    expect(parsed.description).toBe('');
    expect(parsed.paidFromRegister).toBe(false);
  });

  it('exige monto positivo (un gasto de 0 no tiene sentido)', () => {
    expect(expenseSchema.safeParse({ ...valid, amountCents: 0 }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...valid, amountCents: -5 }).success).toBe(false);
  });

  it.each(['2026-02-30', '22/11/2026', '2026-11-22T10:00:00Z'])('rechaza fecha "%s"', (date) => {
    expect(expenseSchema.safeParse({ ...valid, date }).success).toBe(false);
  });
});

describe('expenseCategorySchema', () => {
  it('acepta nombre, padre y color hex', () => {
    expect(expenseCategorySchema.safeParse({ name: 'Gas', parentId: null, color: '#FF8800' }).success).toBe(true);
  });

  it('rechaza color que no sea hex de 6 dígitos', () => {
    expect(expenseCategorySchema.safeParse({ name: 'Gas', color: 'rojo' }).success).toBe(false);
  });

  it('rechaza nombre vacío', () => {
    expect(expenseCategorySchema.safeParse({ name: '  ' }).success).toBe(false);
  });
});

describe('usuarios con rol cashier (D9)', () => {
  it('createUserSchema permite crear cajeros', () => {
    const result = createUserSchema.safeParse({
      email: 'caja@sabor.pe',
      password: 'correcthorsebattery',
      name: 'Caja Uno',
      role: 'cashier',
    });
    expect(result.success).toBe(true);
  });

  it('updateUserSchema permite cambiar a cajero y sigue rechazando roles desconocidos', () => {
    expect(updateUserSchema.safeParse({ role: 'cashier' }).success).toBe(true);
    expect(updateUserSchema.safeParse({ role: 'superadmin' }).success).toBe(false);
  });
});
