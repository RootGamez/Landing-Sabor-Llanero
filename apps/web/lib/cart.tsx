"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { buildCartLineKey, isCartLine, type CartLine, type CartLineInput } from "@/lib/cartLines";

export { buildCartLineKey, cartLineFromItem, findStaleLines } from "@/lib/cartLines";
export type { CartLine, CartLineInput, StaleReason } from "@/lib/cartLines";

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

interface CartActions {
  addLine: (input: CartLineInput, quantity?: number) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
}

/** Último ítem agregado (para el toast de confirmación) — `id` incremental para que el toast note un agregado nuevo incluso si el label se repite (agregar el mismo ítem dos veces seguidas). */
interface LastAdded {
  label: string;
  id: number;
}

interface CartState {
  lines: CartLine[];
  subtotal: number;
  count: number;
  lastAdded: LastAdded | null;
}

// Separado en dos contextos a propósito: `CartActionsContext` nunca cambia de
// referencia (las 4 funciones son `useCallback` con deps `[]`), así que
// `ItemCard`/`ItemModal` — que en /menu hay decenas montados a la vez y solo
// necesitan `addLine` — pueden suscribirse solo a las acciones sin
// re-renderizar cada vez que `lines` cambia en cualquier parte de la app
// (stepper de /carrito, otro ItemCard agregando algo, etc).
const CartActionsContext = createContext<CartActions | null>(null);
const CartStateContext = createContext<CartState | null>(null);

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
  const [lastAdded, setLastAdded] = useState<LastAdded | null>(null);
  const lastAddedIdRef = useRef(0);

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
    setLines((current) => {
      // Carrito viejo: al elegir una presentación/tamaño se reemplaza la línea
      // sin opción (`id:base`) del mismo ítem, que ya no es válida.
      const staleKey = buildCartLineKey(input.itemId, null);
      const prev = input.sizeId != null ? current.filter((line) => line.key !== staleKey) : current;
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
    setLastAdded({
      label: input.sizeLabel ? `${input.name} (${input.sizeLabel})` : input.name,
      id: ++lastAddedIdRef.current,
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
  const state = useMemo<CartState>(
    () => ({ lines, subtotal, count, lastAdded }),
    [lines, subtotal, count, lastAdded],
  );

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
