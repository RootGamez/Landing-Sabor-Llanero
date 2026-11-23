import { useCallback, useState } from 'react';
import { areaForPath, type NavArea, type NavAreaId } from './navConfig';

export type NavDirection = 'forward' | 'back' | 'none';

interface NavViewState {
  pathname: string;
  area: NavAreaId | null;
  direction: NavDirection;
  /** Sube con cada acción del usuario (abrir/volver); sirve para mover el foco. */
  userActions: number;
}

/**
 * Área visible en el menú drill-down. Se deriva de la ruta actual: al navegar
 * o entrar por URL directa se abre el área de esa ruta (o la raíz si es
 * desconocida). Entre navegaciones, el usuario puede abrir un área o volver
 * a la raíz sin cambiar de ruta.
 */
export function useNavArea(pathname: string, areas: readonly NavArea[]) {
  const [state, setState] = useState<NavViewState>(() => ({
    pathname,
    area: areaForPath(areas, pathname),
    direction: 'none',
    userActions: 0,
  }));

  // Ajuste de estado durante el render (patrón React): la ruta manda.
  if (state.pathname !== pathname) {
    setState((prev) => ({
      pathname,
      area: areaForPath(areas, pathname),
      direction: 'none',
      userActions: prev.userActions,
    }));
  }

  const openArea = useCallback((id: NavAreaId) => {
    setState((prev) => ({ ...prev, area: id, direction: 'forward', userActions: prev.userActions + 1 }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => ({ ...prev, area: null, direction: 'back', userActions: prev.userActions + 1 }));
  }, []);

  return { area: state.area, direction: state.direction, userActions: state.userActions, openArea, goBack };
}
