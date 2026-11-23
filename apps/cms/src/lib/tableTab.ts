/**
 * Lógica pura de "Mesas" en el POS (sin React ni DOM): cuenta guardada ↔
 * ticket editable, cambios sin guardar, rebase ante conflictos, tiempo
 * abierta y posición de cada mesa en el plano (en %).
 */
import { MAX_LINE_QUANTITY, lineKeyOf, type CartLine } from './posCart';
import { PLAN_COLS, flavorIdsOf, type DiningTab, type DiningTabItem, type PlanRect } from '@sabor/shared';

/** Una cuenta abierta hace más de esto probablemente quedó olvidada de otro turno. */
export const STALE_TAB_HOURS = 12;

const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;
const DAY_MINUTES = 24 * HOUR_MINUTES;

/** Líneas editables de la cuenta (las de productos borrados del menú no se pueden tocar). */
export function tabToCartLines(tab: DiningTab | null): CartLine[] {
  if (!tab) return [];
  return tab.items
    .filter((item): item is DiningTabItem & { itemId: number } => item.itemId !== null)
    .map((item) => {
      // Sabores/nota guardados: la clave los incluye (misma identidad que el ticket y que el diff del servidor).
      const flavors = flavorIdsOf(item.flavors ?? null);
      const note = item.note ?? null;
      return {
        key: lineKeyOf({ itemId: item.itemId, sizeId: item.sizeId, flavors, note }),
        itemId: item.itemId,
        sizeId: item.sizeId,
        name: item.name,
        sizeLabel: item.sizeLabel,
        unitPriceCents: item.unitPriceCents,
        quantity: Math.min(item.quantity, MAX_LINE_QUANTITY),
        flavors,
        flavorInfo: item.flavors ?? null,
        note,
      };
    });
}

/** Productos de la cuenta que ya no existen en el menú: se cobran igual, pero no se editan. */
export function lockedTabItems(tab: DiningTab | null): DiningTabItem[] {
  return tab ? tab.items.filter((item) => item.itemId === null) : [];
}

export function savedQuantities(tab: DiningTab | null): Map<string, number> {
  return new Map(tabToCartLines(tab).map((line) => [line.key, line.quantity]));
}

/** ¿El ticket difiere de lo guardado (algo agregado, quitado o con otra cantidad)? */
export function isDraftDirty(lines: readonly CartLine[], saved: ReadonlyMap<string, number>): boolean {
  if (lines.length !== saved.size) return true;
  return lines.some((line) => saved.get(line.key) !== line.quantity);
}

/** Unidades agregadas desde el último guardado (lo que va "a cocina" en esta tanda). */
export function newUnitsCount(lines: readonly CartLine[], saved: ReadonlyMap<string, number>): number {
  return lines.reduce((sum, line) => sum + Math.max(line.quantity - (saved.get(line.key) ?? 0), 0), 0);
}

/**
 * Conflicto (otra persona guardó la misma mesa): parte de la versión nueva del
 * servidor y vuelve a sumar SOLO lo que este dispositivo agregó sobre lo que
 * había visto. Las reducciones locales se descartan (que las revise de nuevo).
 */
export function rebaseDraft(
  previousSaved: ReadonlyMap<string, number>,
  local: readonly CartLine[],
  server: readonly CartLine[],
): CartLine[] {
  const added = new Map<string, CartLine & { delta: number }>();
  for (const line of local) {
    const delta = line.quantity - (previousSaved.get(line.key) ?? 0);
    if (delta > 0) added.set(line.key, { ...line, delta });
  }
  const merged = server.map((line) => {
    const extra = added.get(line.key);
    return extra ? { ...line, quantity: Math.min(line.quantity + extra.delta, MAX_LINE_QUANTITY) } : line;
  });
  const serverKeys = new Set(server.map((line) => line.key));
  const appended = [...added.values()]
    .filter((line) => !serverKeys.has(line.key))
    .map(({ delta, ...line }) => ({ ...line, quantity: Math.min(delta, MAX_LINE_QUANTITY) }));
  return [...merged, ...appended];
}

/** Fecha UTC de D1 ("YYYY-MM-DD HH:MM:SS") → milisegundos. */
export function sqliteUtcToMs(value: string): number {
  return new Date(`${value.replace(' ', 'T')}Z`).getTime();
}

function minutesOpen(openedAt: string, nowMs: number): number {
  const opened = sqliteUtcToMs(openedAt);
  if (!Number.isFinite(opened)) return 0;
  return Math.max(0, Math.floor((nowMs - opened) / MINUTE_MS));
}

/** "Recién", "25 min", "1 h 05 min", "2 d 3 h". */
export function formatElapsed(openedAt: string, nowMs: number): string {
  const minutes = minutesOpen(openedAt, nowMs);
  if (minutes < 1) return 'Recién';
  if (minutes < HOUR_MINUTES) return `${minutes} min`;
  if (minutes < DAY_MINUTES) {
    const rest = minutes % HOUR_MINUTES;
    return `${Math.floor(minutes / HOUR_MINUTES)} h ${String(rest).padStart(2, '0')} min`;
  }
  return `${Math.floor(minutes / DAY_MINUTES)} d ${Math.floor((minutes % DAY_MINUTES) / HOUR_MINUTES)} h`;
}

/** "recién abierta" / "abierta hace 25 min". */
export function formatOpenedAgo(openedAt: string, nowMs: number): string {
  const elapsed = formatElapsed(openedAt, nowMs);
  return elapsed === 'Recién' ? 'recién abierta' : `abierta hace ${elapsed}`;
}

export function isStaleTab(openedAt: string, nowMs: number): boolean {
  return minutesOpen(openedAt, nowMs) >= STALE_TAB_HOURS * HOUR_MINUTES;
}

/** Posición de una mesa en el plano como porcentajes (escala a cualquier ancho sin scroll). */
export function planBox(rect: PlanRect, rows: number): { left: string; top: string; width: string; height: string } {
  const pct = (value: number, total: number) => `${(value / total) * 100}%`;
  return {
    left: pct(rect.x, PLAN_COLS),
    top: pct(rect.y, rows),
    width: pct(rect.w, PLAN_COLS),
    height: pct(rect.h, rows),
  };
}
