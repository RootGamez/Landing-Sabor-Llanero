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

/** Roles con acceso al back-office completo; el cajero (D9) solo ve el POS y su perfil. */
const BACKOFFICE: readonly Role[] = ['owner', 'admin'];
/** Todos los roles de staff: el cajero solo cierra su caja y comparte el resumen (D9). */
const ALL_STAFF: readonly Role[] = ['owner', 'admin', 'cashier'];

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'inicio',
    label: 'Inicio',
    collapsible: false,
    items: [{ to: '/', label: 'Inicio', icon: LayoutDashboard, end: true, roles: BACKOFFICE }],
  },
  {
    id: 'ventas',
    label: 'Ventas',
    collapsible: true,
    items: [
      { to: '/ventas/pos', label: 'Punto de venta', icon: ShoppingCart },
      { to: '/ventas/cierres', label: 'Cierres de caja', icon: Calculator, roles: ALL_STAFF },
      { to: '/ventas/historial', label: 'Historial de ventas', icon: History, roles: BACKOFFICE },
    ],
  },
  {
    id: 'gastos',
    label: 'Gastos',
    collapsible: true,
    items: [
      { to: '/gastos', label: 'Registrar gastos', icon: Receipt, end: true, roles: BACKOFFICE },
      { to: '/gastos/importar', label: 'Importar', icon: Upload, roles: BACKOFFICE },
      { to: '/gastos/categorias', label: 'Categorías de gastos', icon: Tags, roles: BACKOFFICE },
    ],
  },
  {
    id: 'tienda',
    label: 'Tienda online',
    collapsible: true,
    items: [
      { to: '/tienda/pedidos', label: 'Pedidos', icon: ClipboardList, roles: BACKOFFICE },
      { to: '/tienda/menu', label: 'Menú', icon: Pizza, roles: BACKOFFICE },
      { to: '/tienda/categorias', label: 'Categorías del menú', icon: Tags, roles: BACKOFFICE },
      { to: '/tienda/destacados', label: 'Destacados', icon: Sparkles, roles: BACKOFFICE },
      { to: '/tienda/premios', label: 'Premios', icon: Gift, roles: BACKOFFICE },
      { to: '/tienda/sorteo', label: 'Sorteo', icon: Dices, roles: BACKOFFICE },
      { to: '/tienda/puntos', label: 'Puntos', icon: Star, roles: BACKOFFICE },
      { to: '/tienda/whatsapp', label: 'WhatsApp', icon: MessageCircle, roles: BACKOFFICE },
    ],
  },
  {
    id: 'reportes',
    label: 'Reportes',
    collapsible: false,
    items: [{ to: '/reportes', label: 'Reportes', icon: BarChart3, roles: BACKOFFICE }],
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
