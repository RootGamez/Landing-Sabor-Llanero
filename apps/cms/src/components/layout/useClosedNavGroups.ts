import { useCallback, useEffect, useState } from 'react';
import { NAV_GROUPS, isGroupActive } from './navConfig';

const STORAGE_KEY = 'cms:nav-closed-groups';

function readClosedGroups(): readonly string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    // localStorage bloqueado o JSON corrupto: se empieza con todo expandido.
    return [];
  }
}

function writeClosedGroups(ids: readonly string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Modo privado / cuota llena: el estado solo vive en memoria.
  }
}

/** Ids de los grupos que contienen la ruta actual. */
function activeGroupIds(pathname: string): string[] {
  return NAV_GROUPS.filter((group) => isGroupActive(group, pathname)).map((group) => group.id);
}

/**
 * Estado "grupo cerrado" del sidebar, recordado en localStorage. Al navegar
 * (o al entrar por URL directa) el grupo de la ruta activa se reabre, para
 * que el ítem resaltado nunca quede oculto.
 */
export function useClosedNavGroups(pathname: string) {
  const [closed, setClosed] = useState<readonly string[]>(() => {
    const active = activeGroupIds(pathname);
    return readClosedGroups().filter((id) => !active.includes(id));
  });
  const [lastPathname, setLastPathname] = useState(pathname);

  // Ajuste de estado durante el render (patrón React) en vez de un efecto.
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    const active = activeGroupIds(pathname);
    if (closed.some((id) => active.includes(id))) {
      setClosed(closed.filter((id) => !active.includes(id)));
    }
  }

  useEffect(() => {
    writeClosedGroups(closed);
  }, [closed]);

  const toggle = useCallback((groupId: string) => {
    setClosed((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    );
  }, []);

  return { closed, toggle };
}
