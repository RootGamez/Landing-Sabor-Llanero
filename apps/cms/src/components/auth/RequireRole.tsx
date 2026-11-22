import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Role } from '@sabor/shared';
import { useSessionStore } from '../../store/sessionStore';

/** Un rol (compatibilidad con el uso original) o una lista de roles permitidos. */
type RoleRequirement =
  | { role: Role; roles?: never }
  | { roles: readonly Role[]; role?: never };

type RequireRoleProps = RoleRequirement & { children: ReactNode };

/**
 * Guard por rol: deja pasar si el rol del usuario es `role` o está en `roles`.
 * Si no, redirige a `/`.
 *
 * TODO(F3): cuando exista el rol `cashier`, su redirección debe ser `/ventas/pos`
 * (aquí `/` es el dashboard, que el cajero no debe ver) y `/` debe pasar a ser
 * solo para owner/admin.
 */
export function RequireRole({ role, roles, children }: RequireRoleProps) {
  const userRole = useSessionStore((s) => s.user?.role);
  const allowed: readonly Role[] = roles ?? (role ? [role] : []);

  if (!userRole || !allowed.includes(userRole)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
