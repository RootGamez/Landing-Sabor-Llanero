import { create } from 'zustand';
import type { PosCatalog } from '../lib/posCatalog';

/**
 * Último catálogo del POS ya cargado en memoria, para que el ticket (sabores
 * de una línea) lo use sin volver a pedir nada a la red. Lo publica
 * `PosCatalogPanel`; si la carga falló, `error` + `retry` permiten reintentar.
 */
interface PosCatalogState {
  catalog: PosCatalog | null;
  error: string | null;
  retry: (() => void) | null;
  publish: (next: { catalog: PosCatalog | null; error: string | null; retry: () => void }) => void;
}

export const usePosCatalogStore = create<PosCatalogState>()((set) => ({
  catalog: null,
  error: null,
  retry: null,
  publish: (next) => set(next),
}));
