import type { Role } from '@sabor/shared';

/** Pantalla de aterrizaje por rol: el cajero (D9) solo opera el POS; el resto entra al dashboard. */
export function homePathForRole(role: Role | undefined): string {
  return role === 'cashier' ? '/ventas/pos' : '/';
}
