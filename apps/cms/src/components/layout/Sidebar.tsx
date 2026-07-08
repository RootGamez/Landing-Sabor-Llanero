import type { ComponentType } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  CircleUser,
  LogOut,
  MessageCircle,
  Pizza,
  Sparkles,
  Tags,
  Users,
} from 'lucide-react';
import { BRAND } from '@sabor/shared';
import { useSessionStore } from '../../store/sessionStore';
import { cn } from '../../lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end: boolean;
  ownerOnly?: boolean;
}

const LINKS: NavItem[] = [
  { to: '/', label: 'Menú', icon: Pizza, end: true },
  { to: '/categorias', label: 'Categorías', icon: Tags, end: false },
  { to: '/merchandising', label: 'Destacados', icon: Sparkles, end: false },
  { to: '/whatsapp', label: 'WhatsApp', icon: MessageCircle, end: false },
  { to: '/reportes', label: 'Reportes', icon: BarChart3, end: false },
  { to: '/usuarios', label: 'Usuarios', icon: Users, end: false, ownerOnly: true },
  { to: '/perfil', label: 'Mi perfil', icon: CircleUser, end: false },
];

interface SidebarBodyProps {
  /** Modo colapsado (solo iconos). Nunca colapsa dentro del drawer móvil. */
  collapsed?: boolean;
  /** Se llama al navegar (para cerrar el drawer en móvil). */
  onNavigate?: () => void;
}

/**
 * Contenido del sidebar, reutilizado tanto por el aside fijo de escritorio como
 * por el drawer móvil (Sheet). El look oscuro azul de marca da el contraste de
 * un panel de administración profesional frente al contenido claro.
 */
export function SidebarBody({ collapsed = false, onNavigate }: SidebarBodyProps) {
  const user = useSessionStore((s) => s.user);
  const logout = useSessionStore((s) => s.logout);

  const visibleLinks = LINKS.filter((link) => !link.ownerOnly || user?.role === 'owner');

  return (
    <div className="flex h-full flex-col">
      <div className={cn('mb-6 flex items-center gap-2', collapsed && 'justify-center')}>
        <img src="/logo.svg" alt="" width="240" height="110" className="h-8 w-auto shrink-0" />
        {!collapsed && <span className="text-sm font-bold text-text-inverse/80">Admin</span>}
        <span className="sr-only">{BRAND.name}</span>
      </div>

      <nav aria-label="Navegación de administración" className="flex flex-1 flex-col gap-1">
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={onNavigate}
              title={collapsed ? link.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-accent text-accent-foreground shadow-sticker-lime'
                    : 'text-text-inverse/80 hover:bg-white/10 hover:text-text-inverse'
                )
              }
            >
              <Icon className="size-5 shrink-0" />
              {!collapsed && <span>{link.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-white/10 pt-4">
        {!collapsed && <p className="truncate text-xs text-text-inverse/60">{user?.email}</p>}
        <button
          type="button"
          onClick={logout}
          title={collapsed ? 'Cerrar sesión' : undefined}
          className={cn(
            'mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-text-inverse/80 transition-colors hover:bg-white/10 hover:text-accent',
            collapsed && 'justify-center px-0'
          )}
        >
          <LogOut className="size-4 shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </div>
  );
}
