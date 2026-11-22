import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut } from 'lucide-react';
import { BRAND } from '@sabor/shared';
import { useSessionStore } from '../../store/sessionStore';
import { cn } from '../../lib/utils';
import { NAV_GROUPS, filterNavGroups, isGroupActive, type NavGroup, type NavItem } from './navConfig';
import { useClosedNavGroups } from './useClosedNavGroups';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/Collapsible';

/** Anillo de foco visible sobre el fondo azul oscuro (el global es azul sobre azul). */
const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-dark';

interface NavItemLinkProps {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}

/** Enlace de navegación. Objetivo táctil >= 44px; en modo colapsado solo icono. */
function NavItemLink({ item, collapsed, onNavigate }: NavItemLinkProps) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
          FOCUS_RING,
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-accent text-accent-foreground shadow-sticker-lime'
            : 'text-text-inverse/80 hover:bg-white/10 hover:text-text-inverse',
        )
      }
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
    </NavLink>
  );
}

interface NavGroupSectionProps {
  group: NavGroup;
  isOpen: boolean;
  isActive: boolean;
  onToggle: (groupId: string) => void;
  onNavigate?: () => void;
}

/** Grupo colapsable (Radix Collapsible): cabecera con `aria-expanded` + lista de enlaces. */
function NavGroupSection({ group, isOpen, isActive, onToggle, onNavigate }: NavGroupSectionProps) {
  return (
    <li>
      <Collapsible open={isOpen} onOpenChange={() => onToggle(group.id)}>
        <CollapsibleTrigger
          className={cn(
            'flex min-h-11 w-full cursor-pointer items-center justify-between rounded-xl px-3 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-white/10 hover:text-text-inverse',
            FOCUS_RING,
            isActive ? 'text-accent' : 'text-text-inverse/60',
          )}
        >
          <span>
            {group.label}
            {isActive && !isOpen && <span className="sr-only"> (sección actual)</span>}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn('size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none', !isOpen && '-rotate-90')}
          />
        </CollapsibleTrigger>
        <CollapsibleContent asChild>
          <ul className="mt-1 flex flex-col gap-1 pb-2">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavItemLink item={item} collapsed={false} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

interface SidebarBodyProps {
  /** Modo colapsado (solo iconos). Nunca colapsa dentro del drawer móvil. */
  collapsed?: boolean;
  /** Se llama al navegar (para cerrar el drawer en móvil). */
  onNavigate?: () => void;
}

interface CollapsedGroupProps {
  group: NavGroup;
  isFirst: boolean;
  onNavigate?: () => void;
}

/** Grupo en modo solo-iconos: separador fino + iconos (sin cabecera). */
function CollapsedGroup({ group, isFirst, onNavigate }: CollapsedGroupProps) {
  return (
    <>
      {!isFirst && <li aria-hidden="true" className="mx-2 my-1 border-t border-white/10" />}
      {group.items.map((item) => (
        <li key={item.to}>
          <NavItemLink item={item} collapsed onNavigate={onNavigate} />
        </li>
      ))}
    </>
  );
}

/** Lista de navegación: grupos colapsables, enlaces directos o iconos planos. */
function SidebarNav({ collapsed, onNavigate }: Required<Pick<SidebarBodyProps, 'collapsed'>> & Pick<SidebarBodyProps, 'onNavigate'>) {
  const role = useSessionStore((s) => s.user?.role);
  const { pathname } = useLocation();
  const { closed, toggle } = useClosedNavGroups(pathname);
  const groups = filterNavGroups(NAV_GROUPS, role);

  return (
    <nav aria-label="Navegación de administración" className="flex-1">
      <ul className="flex flex-col gap-1">
        {groups.map((group, index) => {
          if (collapsed) {
            return <CollapsedGroup key={group.id} group={group} isFirst={index === 0} onNavigate={onNavigate} />;
          }
          if (!group.collapsible) {
            return group.items.map((item) => (
              <li key={item.to}>
                <NavItemLink item={item} collapsed={false} onNavigate={onNavigate} />
              </li>
            ));
          }
          return (
            <NavGroupSection
              key={group.id}
              group={group}
              isOpen={!closed.includes(group.id)}
              isActive={isGroupActive(group, pathname)}
              onToggle={toggle}
              onNavigate={onNavigate}
            />
          );
        })}
      </ul>
    </nav>
  );
}

/** Email del usuario + botón de cierre de sesión. */
function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const email = useSessionStore((s) => s.user?.email);
  const logout = useSessionStore((s) => s.logout);
  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      {!collapsed && <p className="truncate text-xs text-text-inverse/60">{email}</p>}
      <button
        type="button"
        onClick={logout}
        title={collapsed ? 'Cerrar sesión' : undefined}
        className={cn(
          'mt-2 flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-text-inverse/80 transition-colors hover:bg-white/10 hover:text-accent',
          FOCUS_RING,
          collapsed && 'w-full justify-center px-0',
        )}
      >
        <LogOut className="size-4 shrink-0" aria-hidden="true" />
        <span className={cn(collapsed && 'sr-only')}>Cerrar sesión</span>
      </button>
    </div>
  );
}

/**
 * Contenido del sidebar, reutilizado tanto por el aside fijo de escritorio como
 * por el drawer móvil (Sheet). Navegación agrupada por módulos (`NAV_GROUPS`):
 * expandido muestra grupos colapsables; colapsado muestra todos los iconos en
 * lista plana separados por grupo, para que ningún destino quede oculto.
 */
export function SidebarBody({ collapsed = false, onNavigate }: SidebarBodyProps) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn('mb-6 flex items-center gap-2', collapsed && 'justify-center')}>
        <img src="/logo.svg" alt="" width="240" height="110" className="h-8 w-auto shrink-0" />
        {!collapsed && <span className="text-sm font-bold text-text-inverse/80">Admin</span>}
        <span className="sr-only">{BRAND.name}</span>
      </div>
      <SidebarNav collapsed={collapsed} onNavigate={onNavigate} />
      <SidebarFooter collapsed={collapsed} />
    </div>
  );
}
