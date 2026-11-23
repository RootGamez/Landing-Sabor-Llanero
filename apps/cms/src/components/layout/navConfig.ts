import type { ComponentType } from 'react';
import {
  BarChart3,
  Calculator,
  CircleUser,
  ClipboardList,
  Dices,
  Gift,
  Globe,
  History,
  LayoutDashboard,
  LayoutGrid,
  MessageCircle,
  Pizza,
  Receipt,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Tags,
  Upload,
  Users,
} from 'lucide-react';
import type { Role } from '@sabor/shared';

type NavIcon = ComponentType<{ className?: string }>;

export interface NavItem {
  to: string;
  label: string;
  icon: NavIcon;
  /** `true` solo para rutas raíz (`/`, `/gastos`) que prefijan a otras. */
  end?: boolean;
  /** Roles que ven el ítem. Sin definir: todos los roles autenticados. */
  roles?: readonly Role[];
}

/** Subtítulo + ítems dentro de un área (solo agrupa visualmente). */
export interface NavGroup {
  id: string;
  label: string;
  items: readonly NavItem[];
}

export type NavAreaId = 'pos' | 'carta' | 'web';

/** Área de primer nivel (botón grande del menú raíz). */
export interface NavArea {
  id: NavAreaId;
  label: string;
  description: string;
  icon: NavIcon;
  groups: readonly NavGroup[];
}

/** Roles con acceso al back-office completo; el cajero (D9) solo ve el POS y su perfil. */
const BACKOFFICE: readonly Role[] = ['owner', 'admin'];
/** Todos los roles de staff: el cajero solo cierra su caja y comparte el resumen (D9). */
const ALL_STAFF: readonly Role[] = ['owner', 'admin', 'cashier'];

/** Enlaces del nivel raíz, fuera de las 3 áreas. */
export const ROOT_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, end: true, roles: BACKOFFICE },
  { to: '/ajustes/perfil', label: 'Mi perfil', icon: CircleUser },
];

export const NAV_AREAS: readonly NavArea[] = [
  {
    id: 'pos',
    label: 'POS',
    description: 'Ventas, caja, ingresos y egresos',
    icon: ShoppingCart,
    groups: [
      {
        id: 'ventas',
        label: 'Ventas',
        items: [
          { to: '/ventas/pos', label: 'Punto de venta', icon: ShoppingCart },
          { to: '/ventas/cierres', label: 'Cierres de caja', icon: Calculator, roles: ALL_STAFF },
          { to: '/ventas/historial', label: 'Historial de ventas', icon: History, roles: BACKOFFICE },
          { to: '/ventas/mesas', label: 'Plano de mesas', icon: LayoutGrid, roles: BACKOFFICE },
        ],
      },
      {
        id: 'finanzas',
        label: 'Ingresos y egresos',
        items: [
          { to: '/gastos', label: 'Registrar gastos', icon: Receipt, end: true, roles: BACKOFFICE },
          { to: '/gastos/importar', label: 'Importar', icon: Upload, roles: BACKOFFICE },
          { to: '/gastos/categorias', label: 'Categorías de gastos', icon: Tags, roles: BACKOFFICE },
          { to: '/reportes', label: 'Reportes', icon: BarChart3, roles: BACKOFFICE },
        ],
      },
    ],
  },
  {
    id: 'carta',
    label: 'Carta y negocio',
    description: 'Productos, categorías y usuarios',
    icon: Store,
    groups: [
      {
        id: 'carta',
        label: 'Carta',
        items: [
          { to: '/tienda/menu', label: 'Menú', icon: Pizza, roles: BACKOFFICE },
          { to: '/tienda/categorias', label: 'Categorías del menú', icon: Tags, roles: BACKOFFICE },
        ],
      },
      {
        id: 'negocio',
        label: 'Negocio',
        items: [{ to: '/ajustes/usuarios', label: 'Usuarios', icon: Users, roles: ['owner'] }],
      },
    ],
  },
  {
    id: 'web',
    label: 'Web',
    description: 'Pedidos online, destacados y fidelización',
    icon: Globe,
    groups: [
      {
        id: 'tienda',
        label: 'Tienda online',
        items: [
          { to: '/tienda/pedidos', label: 'Pedidos', icon: ClipboardList, roles: BACKOFFICE },
          { to: '/tienda/destacados', label: 'Destacados', icon: Sparkles, roles: BACKOFFICE },
          { to: '/tienda/whatsapp', label: 'WhatsApp', icon: MessageCircle, roles: BACKOFFICE },
        ],
      },
      {
        id: 'fidelizacion',
        label: 'Fidelización',
        items: [
          { to: '/tienda/premios', label: 'Premios', icon: Gift, roles: BACKOFFICE },
          { to: '/tienda/sorteo', label: 'Sorteo', icon: Dices, roles: BACKOFFICE },
          { to: '/tienda/puntos', label: 'Puntos', icon: Star, roles: BACKOFFICE },
        ],
      },
    ],
  },
];

function canSee(item: NavItem, role: Role | undefined): boolean {
  return !item.roles || (role !== undefined && item.roles.includes(role));
}

/** Áreas con solo los ítems visibles para `role`; omite grupos y áreas vacíos. */
export function filterNavAreas(areas: readonly NavArea[], role: Role | undefined): NavArea[] {
  return areas
    .map((area) => ({
      ...area,
      groups: area.groups
        .map((group) => ({ ...group, items: group.items.filter((item) => canSee(item, role)) }))
        .filter((group) => group.items.length > 0),
    }))
    .filter((area) => area.groups.length > 0);
}

export function filterRootItems(items: readonly NavItem[], role: Role | undefined): NavItem[] {
  return items.filter((item) => canSee(item, role));
}

/** `true` si `pathname` corresponde al ítem (respeta `end`). */
export function isItemActive(item: NavItem, pathname: string): boolean {
  return item.end
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

/**
 * Área a la que pertenece `pathname`, o `null` (raíz) si no es de ninguna.
 * Gana la coincidencia más específica (`/gastos/importar` antes que `/gastos`).
 */
export function areaForPath(areas: readonly NavArea[], pathname: string): NavAreaId | null {
  let best: { id: NavAreaId; length: number } | null = null;
  for (const area of areas) {
    for (const group of area.groups) {
      for (const item of group.items) {
        if (isItemActive(item, pathname) && (!best || item.to.length > best.length)) {
          best = { id: area.id, length: item.to.length };
        }
      }
    }
  }
  return best?.id ?? null;
}
