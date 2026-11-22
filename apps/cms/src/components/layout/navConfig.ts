import type { ComponentType } from 'react';
import {
  BarChart3,
  Calculator,
  CircleUser,
  ClipboardList,
  Dices,
  Gift,
  History,
  LayoutDashboard,
  MessageCircle,
  Pizza,
  Receipt,
  ShoppingCart,
  Sparkles,
  Star,
  Tags,
  Upload,
  Users,
} from 'lucide-react';
import type { Role } from '@sabor/shared';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** `true` solo para rutas raíz de grupo (`/`, `/gastos`) que prefijan a otras. */
  end?: boolean;
  /** Roles que ven el ítem. Sin definir: todos los roles autenticados. */
  roles?: readonly Role[];
}

export interface NavGroup {
  id: string;
  label: string;
  /**
   * `false` para grupos de un solo enlace (Inicio, Reportes): se muestran
   * como enlace directo, sin cabecera ni chevron.
   */
  collapsible: boolean;
  items: readonly NavItem[];
}

// TODO(F3): cuando exista el rol `cashier`, el cajero solo verá el ítem del POS;
// el resto de ítems quedan restringidos a ['owner', 'admin'] con `roles`.
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'inicio',
    label: 'Inicio',
    collapsible: false,
    items: [{ to: '/', label: 'Inicio', icon: LayoutDashboard, end: true }],
  },
  {
    id: 'ventas',
    label: 'Ventas',
    collapsible: true,
    items: [
      { to: '/ventas/pos', label: 'Punto de venta', icon: ShoppingCart },
      { to: '/ventas/cierres', label: 'Cierres de caja', icon: Calculator },
      { to: '/ventas/historial', label: 'Historial de ventas', icon: History },
    ],
  },
  {
    id: 'gastos',
    label: 'Gastos',
    collapsible: true,
    items: [
      { to: '/gastos', label: 'Registrar gastos', icon: Receipt, end: true },
      { to: '/gastos/importar', label: 'Importar', icon: Upload },
      { to: '/gastos/categorias', label: 'Categorías de gastos', icon: Tags },
    ],
  },
  {
    id: 'tienda',
    label: 'Tienda online',
    collapsible: true,
    items: [
      { to: '/tienda/pedidos', label: 'Pedidos', icon: ClipboardList },
      { to: '/tienda/menu', label: 'Menú', icon: Pizza },
      { to: '/tienda/categorias', label: 'Categorías del menú', icon: Tags },
      { to: '/tienda/destacados', label: 'Destacados', icon: Sparkles },
      { to: '/tienda/premios', label: 'Premios', icon: Gift },
      { to: '/tienda/sorteo', label: 'Sorteo', icon: Dices },
      { to: '/tienda/puntos', label: 'Puntos', icon: Star },
      { to: '/tienda/whatsapp', label: 'WhatsApp', icon: MessageCircle },
    ],
  },
  {
    id: 'reportes',
    label: 'Reportes',
    collapsible: false,
    items: [{ to: '/reportes', label: 'Reportes', icon: BarChart3 }],
  },
  {
    id: 'ajustes',
    label: 'Ajustes',
    collapsible: true,
    items: [
      { to: '/ajustes/usuarios', label: 'Usuarios', icon: Users, roles: ['owner'] },
      { to: '/ajustes/perfil', label: 'Mi perfil', icon: CircleUser },
    ],
  },
];

/** Devuelve los grupos con solo los ítems visibles para `role`; omite grupos vacíos. */
export function filterNavGroups(
  groups: readonly NavGroup[],
  role: Role | undefined,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || (role !== undefined && item.roles.includes(role))),
    }))
    .filter((group) => group.items.length > 0);
}

/** `true` si `pathname` pertenece a algún ítem del grupo. */
export function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) =>
    item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
}
