import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Role } from '@sabor/shared';
import { homePathForRole } from '../../lib/homePath';
import { useSessionStore } from '../../store/sessionStore';

/** Un rol (compatibilidad con el uso original) o una lista de roles permitidos. */
type RoleRequirement =
  | { role: Role; roles?: never }
  | { roles: readonly Role[]; role?: never };

type RequireRoleProps = RoleRequirement & { children: ReactNode };

/**
 * Guard por rol: deja pasar si el rol del usuario es `role` o está en `roles`.
 * Si no, redirige a la pantalla de inicio de su rol (el cajero va al POS, no al
 * dashboard; sin rol, a `/login` vía RequireAuth).
 */
export function RequireRole({ role, roles, children }: RequireRoleProps) {
  const userRole = useSessionStore((s) => s.user?.role);
  const allowed: readonly Role[] = roles ?? (role ? [role] : []);

  if (!userRole || !allowed.includes(userRole)) {
    return <Navigate to={homePathForRole(userRole)} replace />;
  }
  return <>{children}</>;
}
