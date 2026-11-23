import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronRight, LogOut, MoveLeft } from 'lucide-react';
import { BRAND } from '@sabor/shared';
import { useSessionStore } from '../../store/sessionStore';
import { cn } from '../../lib/utils';
import {
  NAV_AREAS,
  ROOT_ITEMS,
  filterNavAreas,
  filterRootItems,
  type NavArea,
  type NavItem,
} from './navConfig';
import { useNavArea, type NavDirection } from './useNavArea';

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

interface AreaButtonProps {
  area: NavArea;
  collapsed: boolean;
  onOpen: (id: NavArea['id']) => void;
}

/** Botón grande del nivel raíz que abre un área. */
function AreaButton({ area, collapsed, onOpen }: AreaButtonProps) {
  const Icon = area.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen(area.id)}
      title={collapsed ? area.label : undefined}
      aria-label={collapsed ? area.label : undefined}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 border-white/15 bg-white/5 px-3 py-3 text-left text-text-inverse transition-colors hover:border-accent hover:bg-white/10 active:scale-[0.97] motion-reduce:active:scale-100',
        FOCUS_RING,
        collapsed ? 'min-h-12 justify-center px-0' : 'min-h-16',
      )}
    >
      <Icon className="size-6 shrink-0 text-accent" aria-hidden="true" />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold">{area.label}</span>
            <span className="block text-xs text-text-inverse/60">{area.description}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-text-inverse/60" aria-hidden="true" />
        </>
      )}
    </button>
  );
}

interface RootViewProps {
  areas: readonly NavArea[];
  rootItems: readonly NavItem[];
  collapsed: boolean;
  onOpen: (id: NavArea['id']) => void;
  onNavigate?: () => void;
}

/** Nivel raíz: Inicio, las 3 áreas como botones grandes y enlaces sueltos (Mi perfil). */
function RootView({ areas, rootItems, collapsed, onOpen, onNavigate }: RootViewProps) {
  const [home, ...rest] = rootItems;
  return (
    <ul className="flex flex-col gap-2">
      {home && (
        <li>
          <NavItemLink item={home} collapsed={collapsed} onNavigate={onNavigate} />
        </li>
      )}
      {areas.map((area) => (
        <li key={area.id}>
          <AreaButton area={area} collapsed={collapsed} onOpen={onOpen} />
        </li>
      ))}
      {rest.length > 0 && <li aria-hidden="true" className="mx-2 my-1 border-t border-white/10" />}
      {rest.map((item) => (
        <li key={item.to}>
          <NavItemLink item={item} collapsed={collapsed} onNavigate={onNavigate} />
        </li>
      ))}
    </ul>
  );
}

interface AreaViewProps {
  area: NavArea;
  collapsed: boolean;
  onBack: () => void;
  onNavigate?: () => void;
}

/** Submenú de un área: botón "Volver" arriba + grupos de enlaces. */
function AreaView({ area, collapsed, onBack, onNavigate }: AreaViewProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        data-nav-autofocus
        aria-label="Volver al menú principal"
        title={collapsed ? 'Volver' : undefined}
        className={cn(
          'mb-3 flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-bold text-text-inverse/80 transition-colors hover:bg-white/10 hover:text-text-inverse',
          FOCUS_RING,
          collapsed && 'justify-center px-0',
        )}
      >
        <MoveLeft className="size-4 shrink-0" aria-hidden="true" />
        <span className={cn(collapsed && 'sr-only')}>Volver</span>
      </button>
      <h2
        className={cn(
          'mb-2 px-3 text-xs font-bold uppercase tracking-wider text-accent',
          collapsed && 'sr-only',
        )}
      >
        {area.label}
      </h2>
      <ul className="flex flex-col gap-1">
        {area.groups.map((group, index) => (
          <li key={group.id}>
            {area.groups.length > 1 && !collapsed && (
              <p className="mt-3 mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-text-inverse/50">
                {group.label}
              </p>
            )}
            {collapsed && index > 0 && <div aria-hidden="true" className="mx-2 my-1 border-t border-white/10" />}
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavItemLink item={item} collapsed={collapsed} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SLIDE_CLASS: Record<NavDirection, string> = {
  forward: 'animate-in fade-in-0 slide-in-from-right-6 duration-200 motion-reduce:animate-none',
  back: 'animate-in fade-in-0 slide-in-from-left-6 duration-200 motion-reduce:animate-none',
  none: '',
};

interface SidebarBodyProps {
  /** Modo colapsado (solo iconos). Nunca colapsa dentro del drawer móvil. */
  collapsed?: boolean;
  /** Se llama al navegar (para cerrar el drawer en móvil). */
  onNavigate?: () => void;
}

/** Menú drill-down: raíz con 3 áreas; al elegir una se reemplaza por su submenú. */
function SidebarNav({ collapsed, onNavigate }: Required<Pick<SidebarBodyProps, 'collapsed'>> & Pick<SidebarBodyProps, 'onNavigate'>) {
  const role = useSessionStore((s) => s.user?.role);
  const { pathname } = useLocation();
  const areas = filterNavAreas(NAV_AREAS, role);
  const rootItems = filterRootItems(ROOT_ITEMS, role);
  const { area: areaId, direction, userActions, openArea, goBack } = useNavArea(pathname, areas);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeArea = areas.find((a) => a.id === areaId);

  // Tras abrir/volver, el foco pasa al primer control de la vista nueva
  // ("Volver" en un área, primer elemento en la raíz) para no perderlo al desmontar.
  useEffect(() => {
    if (userActions === 0) return;
    const target = containerRef.current?.querySelector<HTMLElement>('[data-nav-autofocus], a, button');
    target?.focus();
  }, [userActions]);

  return (
    <nav aria-label="Navegación de administración" className="flex-1 overflow-x-hidden">
      <div ref={containerRef} key={activeArea?.id ?? 'root'} className={SLIDE_CLASS[direction]}>
        {activeArea ? (
          <AreaView area={activeArea} collapsed={collapsed} onBack={goBack} onNavigate={onNavigate} />
        ) : (
          <RootView areas={areas} rootItems={rootItems} collapsed={collapsed} onOpen={openArea} onNavigate={onNavigate} />
        )}
      </div>
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
 * por el drawer móvil (Sheet). Navegación drill-down por áreas (`NAV_AREAS`):
 * raíz con POS / Carta y negocio / Web, y submenú por área con "Volver".
 * Colapsado muestra solo iconos en ambos niveles.
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
