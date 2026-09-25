"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Carrito multi-ítem para invitados (P2.7, sin cuenta): Context + localStorage,
 * mismo patrón de hidratación segura que `lib/lang.tsx` — el server (export
 * estático) siempre renderiza un carrito vacío, y el valor real se aplica
 * recién en un `useEffect` para no producir mismatch de hidratación.
 *
 * Vive en `app/layout.tsx` (raíz), no en una página puntual: así el badge del
 * Navbar y la página /carrito comparten la misma instancia mientras se navega
 * client-side entre rutas, sin depender de releer localStorage en cada page.
 */
const STORAGE_KEY = "sabor-llanero-cart";

export interface CartLine {
  /** Identifica la línea: mismo ítem+tamaño acumula cantidad, no duplica fila. */
  key: string;
  itemId: number;
  /** Slug del ítem, para armar el anchor de vuelta a /menu (mismo criterio que itemUrl de whatsapp.ts). */
  itemSlug: string;
  /** Nombre ya resuelto en el idioma activo al momento de agregar (snapshot, igual que order_items). */
  name: string;
  sizeLabel: string | null;
  unitPrice: number;
  quantity: number;
}

export type CartLineInput = Omit<CartLine, "quantity">;

interface CartActions {
  addLine: (input: CartLineInput, quantity?: number) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
}

interface CartState {
  lines: CartLine[];
  subtotal: number;
  count: number;
}

// Separado en dos contextos a propósito: `CartActionsContext` nunca cambia de
// referencia (las 4 funciones son `useCallback` con deps `[]`), así que
// `ItemCard`/`ItemModal` — que en /menu hay decenas montados a la vez y solo
// necesitan `addLine` — pueden suscribirse solo a las acciones sin
// re-renderizar cada vez que `lines` cambia en cualquier parte de la app
// (stepper de /carrito, otro ItemCard agregando algo, etc).
const CartActionsContext = createContext<CartActions | null>(null);
const CartStateContext = createContext<CartState | null>(null);

/** Key de línea, genérica para ítems con tamaño (`sizeId` real) o sin tamaño (`null`). */
export function buildCartLineKey(itemId: number, sizeId: number | null): string {
  return sizeId != null ? `${itemId}:${sizeId}` : `${itemId}:base`;
}

interface CartLineCandidate {
  item: { id: number; slug: string; price: number | null };
  hasSizes: boolean;
  selectedPrice: { sizeId: number; price: number } | null;
  name: string;
  /** Label del tamaño ya resuelto en el idioma activo (vía `sizeLabelFor`); ignorado si `!hasSizes`. */
  sizeLabel: string | null;
}

/**
 * Arma el `CartLineInput` para el ítem/tamaño actualmente seleccionado en una
 * card o en el modal — mismo cálculo en ambos (ItemCard.tsx e ItemModal.tsx),
 * extraído acá para no duplicarlo. Devuelve `null` si no hay precio resuelto
 * todavía (ítem con tamaños sin seleccionar, o item.price nulo).
 */
export function cartLineFromItem(candidate: CartLineCandidate): CartLineInput | null {
  const { item, hasSizes, selectedPrice, name, sizeLabel } = candidate;
  if (hasSizes) {
    if (!selectedPrice) return null;
    return {
      key: buildCartLineKey(item.id, selectedPrice.sizeId),
      itemId: item.id,
      itemSlug: item.slug,
      name,
      sizeLabel,
      unitPrice: selectedPrice.price,
    };
  }
  if (item.price == null) return null;
  return {
    key: buildCartLineKey(item.id, null),
    itemId: item.id,
    itemSlug: item.slug,
    name,
    sizeLabel: null,
    unitPrice: item.price,
  };
}

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.key === "string" &&
    typeof line.itemId === "number" &&
    typeof line.itemSlug === "string" &&
    typeof line.name === "string" &&
    (line.sizeLabel === null || typeof line.sizeLabel === "string") &&
    typeof line.unitPrice === "number" &&
    typeof line.quantity === "number" &&
    line.quantity > 0
  );
}

function readStoredCart(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCartLine) : [];
  } catch {
    return []; // localStorage bloqueado o dato corrupto: arrancar con carrito vacío
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLines(readStoredCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    // Antes de hidratar no se persiste: pisaría el localStorage real con [].
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Sin persistencia disponible: el carrito igual funciona en memoria durante la sesión.
    }
  }, [lines, hydrated]);

  const addLine = useCallback((input: CartLineInput, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((line) => line.key === input.key);
      if (existing) {
        // Se refresca con `input` (no solo la cantidad): si el usuario cambió
        // el toggle ES/EN entre un agregado y otro del mismo ítem+tamaño, el
        // nombre/tamaño mostrados deben quedar en el idioma más reciente.
        return prev.map((line) =>
          line.key === input.key ? { ...input, quantity: line.quantity + quantity } : line,
        );
      }
      return [...prev, { ...input, quantity }];
    });
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setLines((prev) => {
      if (quantity <= 0) return prev.filter((line) => line.key !== key);
      return prev.map((line) => (line.key === key ? { ...line, quantity } : line));
    });
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) => prev.filter((line) => line.key !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const subtotal = useMemo(
    () => round2(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)),
    [lines],
  );
  const count = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);

  // Deps `[]` en las 4 acciones → esta referencia es estable de por vida.
  const actions = useMemo<CartActions>(
    () => ({ addLine, updateQuantity, removeLine, clear }),
    [addLine, updateQuantity, removeLine, clear],
  );
  const state = useMemo<CartState>(() => ({ lines, subtotal, count }), [lines, subtotal, count]);

  return (
    <CartActionsContext.Provider value={actions}>
      <CartStateContext.Provider value={state}>{children}</CartStateContext.Provider>
    </CartActionsContext.Provider>
  );
}

/** Solo las acciones (referencia estable) — para componentes que agregan al carrito sin mostrar su contenido (ItemCard, ItemModal). */
export function useCartActions(): CartActions {
  const ctx = useContext(CartActionsContext);
  if (!ctx) throw new Error("useCartActions debe usarse dentro de <CartProvider>");
  return ctx;
}

/** Estado + acciones — para componentes que muestran el contenido del carrito (CartButton, CartPageContent). */
export function useCart(): CartState & CartActions {
  const actions = useCartActions();
  const state = useContext(CartStateContext);
  if (!state) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return { ...state, ...actions };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
