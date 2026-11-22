import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import {
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  addLine,
  cartSubtotal,
  changeQuantity,
  lineKey,
  newClientUuid,
  removeLine,
  repriceLines,
  type CartLine,
  type NewCartLine,
  type PriceSource,
} from '../lib/posCart';

interface PosCartState {
  lines: CartLine[];
  discountCents: number;
  /** Idempotencia del cobro: estable entre reintentos, nuevo cuando cambia el contenido del ticket. */
  clientUuid: string;
  add: (line: NewCartLine) => void;
  increment: (key: string) => void;
  decrement: (key: string) => void;
  remove: (key: string) => void;
  setDiscount: (cents: number) => void;
  clear: () => void;
  /** Alinea precios con el catálogo vigente; devuelve las líneas que ya no existen. */
  reprice: (lookup: (itemId: number, sizeId: number | null) => PriceSource | undefined) => CartLine[];
}

/** sessionStorage puede no existir o lanzar (modo privado, cuota): el carrito sigue funcionando en memoria. */
const safeSessionStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.sessionStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.sessionStorage.setItem(name, value);
    } catch {
      /* sin persistencia: se ignora a propósito */
    }
  },
  removeItem: (name) => {
    try {
      window.sessionStorage.removeItem(name);
    } catch {
      /* sin persistencia: se ignora a propósito */
    }
  },
};

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.key === 'string' &&
    Number.isInteger(line.itemId) &&
    (line.sizeId === null || Number.isInteger(line.sizeId)) &&
    typeof line.name === 'string' &&
    (line.sizeLabel === null || typeof line.sizeLabel === 'string') &&
    Number.isInteger(line.unitPriceCents) &&
    Number.isInteger(line.quantity) &&
    (line.quantity as number) > 0 &&
    (line.quantity as number) <= MAX_LINE_QUANTITY &&
    (line.unitPriceCents as number) >= 0 &&
    line.key === lineKey(line.itemId as number, line.sizeId as number | null)
  );
}

/** Descarta líneas inválidas, con clave repetida o por encima del tope de líneas. */
function validLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const lines: CartLine[] = [];
  for (const candidate of raw) {
    if (!isCartLine(candidate) || seen.has(candidate.key) || lines.length >= MAX_CART_LINES) continue;
    seen.add(candidate.key);
    lines.push(candidate);
  }
  return lines;
}

/** Lo que vuelve del storage no es de fiar: se descarta lo que no tenga la forma esperada. */
function sanitizePersisted(persisted: unknown): Pick<PosCartState, 'lines' | 'discountCents' | 'clientUuid'> {
  const raw = (typeof persisted === 'object' && persisted !== null ? persisted : {}) as Record<string, unknown>;
  const lines = validLines(raw.lines);
  const discount = Number.isInteger(raw.discountCents) ? (raw.discountCents as number) : 0;
  return {
    lines,
    discountCents: Math.min(Math.max(discount, 0), cartSubtotal(lines)),
    clientUuid: typeof raw.clientUuid === 'string' && raw.clientUuid ? raw.clientUuid : newClientUuid(),
  };
}

/** Todo cambio en el ticket invalida el `clientUuid`: un reintento solo debe repetir el MISMO contenido. */
function withFreshUuid(lines: CartLine[], discountCents: number) {
  return {
    lines,
    discountCents: Math.min(discountCents, cartSubtotal(lines)),
    clientUuid: newClientUuid(),
  };
}

export const usePosCartStore = create<PosCartState>()(
  persist(
    (set, get) => ({
      lines: [],
      discountCents: 0,
      clientUuid: newClientUuid(),
      add: (line) => set((s) => withFreshUuid(addLine(s.lines, line), s.discountCents)),
      increment: (key) => set((s) => withFreshUuid(changeQuantity(s.lines, key, 1), s.discountCents)),
      decrement: (key) => set((s) => withFreshUuid(changeQuantity(s.lines, key, -1), s.discountCents)),
      remove: (key) => set((s) => withFreshUuid(removeLine(s.lines, key), s.discountCents)),
      setDiscount: (cents) =>
        set((s) => ({ discountCents: Math.min(Math.max(cents, 0), cartSubtotal(s.lines)), clientUuid: newClientUuid() })),
      clear: () => set(withFreshUuid([], 0)),
      reprice: (lookup) => {
        const result = repriceLines(get().lines, lookup);
        if (result.changed) set((s) => withFreshUuid(result.lines, s.discountCents));
        return result.removed;
      },
    }),
    {
      name: 'sabor-pos-cart',
      version: 1,
      storage: createJSONStorage(() => safeSessionStorage),
      partialize: (s) => ({ lines: s.lines, discountCents: s.discountCents, clientUuid: s.clientUuid }),
      merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
    },
  ),
);
