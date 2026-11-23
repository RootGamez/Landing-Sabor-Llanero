import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from '@sabor/shared';
import { usePosCartStore } from './posCartStore';

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

interface SessionState {
  token: string | null;
  user: SessionUser | null;
  setSession: (token: string, user: SessionUser) => void;
  logout: () => void;
}

/**
 * Sesión del CMS persistida en localStorage. Solo se guarda el token + datos
 * básicos del usuario, nunca contraseñas.
 */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      // El ticket a medias es de quien lo armó: no debe heredarlo la próxima persona en la misma pestaña.
      logout: () => {
        usePosCartStore.getState().clear();
        set({ token: null, user: null });
      },
    }),
    { name: 'sabor-cms-session' },
  ),
);
