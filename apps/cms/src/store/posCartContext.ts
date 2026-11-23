import { createContext, useContext } from 'react';
import { useStore, type StoreApi } from 'zustand';
import { usePosCartStore, type PosCartState } from './posCartStore';

/**
 * Qué ticket editan los componentes del POS (catálogo, ticket, barra móvil).
 * Por defecto el del mostrador (persistido); la vista de una mesa provee su
 * propio store en memoria con `<PosCartContext.Provider value={store}>`, así
 * se reutilizan los mismos componentes sin duplicarlos.
 */
export const PosCartContext = createContext<StoreApi<PosCartState>>(usePosCartStore);

export function useCartApi(): StoreApi<PosCartState> {
  return useContext(PosCartContext);
}

export function useCart<T>(selector: (state: PosCartState) => T): T {
  return useStore(useCartApi(), selector);
}
