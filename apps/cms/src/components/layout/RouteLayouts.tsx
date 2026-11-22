import { Outlet } from 'react-router-dom';
import type { Role } from '@sabor/shared';
import { RequireAuth } from '../auth/RequireAuth';
import { RequireRole } from '../auth/RequireRole';
import { AppShell } from './AppShell';
import { PosShell } from './PosShell';

/** Layout de ruta: autenticación + shell con sidebar. Se mantiene montado al navegar. */
export function ShellLayout() {
  return (
    <RequireAuth>
      <AppShell>
        <Outlet />
      </AppShell>
    </RequireAuth>
  );
}

/** Layout de ruta: autenticación + POS a pantalla completa (sin sidebar). */
export function PosLayout() {
  return (
    <RequireAuth>
      <PosShell>
        <Outlet />
      </PosShell>
    </RequireAuth>
  );
}

/** Layout de ruta anidado: restringe las rutas hijas a los roles indicados. */
export function RoleLayout({ roles }: { roles: readonly Role[] }) {
  return (
    <RequireRole roles={roles}>
      <Outlet />
    </RequireRole>
  );
}
