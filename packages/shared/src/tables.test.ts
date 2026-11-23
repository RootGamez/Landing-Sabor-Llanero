import { describe, expect, it } from 'vitest';
import {
  PLAN_COLS,
  PLAN_MAX_ROWS,
  PLAN_MIN_ROWS,
  closeTabSchema,
  diningTableCreateSchema,
  diningTableUpdateSchema,
  findFreeSpot,
  findOverlap,
  fitsInPlan,
  planRows,
  rectsOverlap,
  saveTabSchema,
  tableDisplayName,
  voidTabSchema,
} from './tables';

/** Plano por defecto de la migración 0010 (el dibujo del dueño). */
const DEFAULT_PLAN = [
  { id: 1, x: 1, y: 6, w: 4, h: 2 },
  { id: 2, x: 1, y: 3, w: 4, h: 2 },
  { id: 3, x: 1, y: 0, w: 4, h: 2 },
  { id: 4, x: 7, y: 2, w: 2, h: 2 },
  { id: 5, x: 7, y: 5, w: 2, h: 2 },
];

describe('plano: geometría', () => {
  it('detecta solapes y deja pasar mesas que solo se tocan por el borde', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2 })).toBe(true);
    expect(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 })).toBe(false);
    expect(rectsOverlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 0, y: 2, w: 2, h: 2 })).toBe(false);
  });

  it('el plano por defecto no tiene solapes y cabe en el plano mínimo', () => {
    for (const table of DEFAULT_PLAN) {
      expect(fitsInPlan(table)).toBe(true);
      expect(findOverlap(table, DEFAULT_PLAN, table.id)).toBeUndefined();
    }
    expect(planRows(DEFAULT_PLAN)).toBe(PLAN_MIN_ROWS);
  });

  it('findOverlap ignora a la propia mesa y devuelve la que choca', () => {
    expect(findOverlap({ x: 2, y: 1, w: 2, h: 2 }, DEFAULT_PLAN, 99)?.id).toBe(3);
    expect(findOverlap({ x: 1, y: 0, w: 4, h: 2 }, DEFAULT_PLAN, 3)).toBeUndefined();
  });

  it('rechaza mesas fuera del plano, vacías o demasiado grandes', () => {
    expect(fitsInPlan({ x: PLAN_COLS - 1, y: 0, w: 2, h: 1 })).toBe(false);
    expect(fitsInPlan({ x: 0, y: PLAN_MAX_ROWS - 1, w: 1, h: 2 })).toBe(false);
    expect(fitsInPlan({ x: -1, y: 0, w: 1, h: 1 })).toBe(false);
    expect(fitsInPlan({ x: 0, y: 0, w: 0, h: 1 })).toBe(false);
    expect(fitsInPlan({ x: 0, y: 0, w: 7, h: 1 })).toBe(false);
    expect(fitsInPlan({ x: 0, y: 0, w: 1.5, h: 1 })).toBe(false);
  });

  it('planRows crece con la mesa más baja hasta el máximo', () => {
    expect(planRows([])).toBe(PLAN_MIN_ROWS);
    expect(planRows([{ x: 0, y: 9, w: 1, h: 2 }])).toBe(11);
  });

  it('findFreeSpot encuentra el primer hueco libre y null si el plano está lleno', () => {
    expect(findFreeSpot(2, 2, DEFAULT_PLAN)).toEqual({ x: 5, y: 0, w: 2, h: 2 });
    const full = [{ x: 0, y: 0, w: PLAN_COLS, h: PLAN_MAX_ROWS }];
    expect(findFreeSpot(1, 1, full)).toBeNull();
  });

  it('tableDisplayName antepone "Mesa" solo a etiquetas numéricas', () => {
    expect(tableDisplayName('3')).toBe('Mesa 3');
    expect(tableDisplayName(' Barra ')).toBe('Barra');
  });
});

describe('esquemas de mesas', () => {
  it('crea una mesa con forma por defecto y valida la etiqueta', () => {
    expect(diningTableCreateSchema.parse({ label: '6', x: 0, y: 0, w: 2, h: 2 }).shape).toBe('rect');
    expect(diningTableCreateSchema.safeParse({ label: '  ', x: 0, y: 0, w: 2, h: 2 }).success).toBe(false);
    expect(diningTableCreateSchema.safeParse({ label: 'a‮b', x: 0, y: 0, w: 2, h: 2 }).success).toBe(false);
    expect(diningTableCreateSchema.safeParse({ label: '6', x: 0, y: 0, w: 2, h: 2, shape: 'star' }).success).toBe(false);
  });

  it('el PATCH exige al menos un campo', () => {
    expect(diningTableUpdateSchema.safeParse({}).success).toBe(false);
    expect(diningTableUpdateSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it('guardar pedido: lista de ítems sin precios y versión esperada (null = mesa libre)', () => {
    expect(saveTabSchema.safeParse({ expectedVersion: null, items: [{ itemId: 1, quantity: 2 }] }).success).toBe(true);
    expect(saveTabSchema.safeParse({ expectedVersion: 0, items: [] }).success).toBe(false);
    expect(
      saveTabSchema.safeParse({
        expectedVersion: 1,
        items: [
          { itemId: 1, quantity: 1 },
          { itemId: 1, quantity: 1 },
        ],
      }).success,
    ).toBe(false);
  });

  it('cerrar y anular exigen la cuenta concreta', () => {
    expect(closeTabSchema.parse({ tabId: 1, expectedVersion: 2 }).discountCents).toBe(0);
    expect(closeTabSchema.safeParse({ expectedVersion: 2 }).success).toBe(false);
    expect(voidTabSchema.safeParse({ tabId: 1, reason: '' }).success).toBe(false);
  });
});
