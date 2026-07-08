import { useEffect, useState, type ReactNode } from 'react';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { SidebarBody } from './Sidebar';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { cn } from '../../lib/utils';

const COLLAPSE_KEY = 'cms:sidebar-collapsed';

function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(COLLAPSE_KEY) === '1';
}

/**
 * Shell de administración: en escritorio un aside azul de marca colapsable
 * (persistido en localStorage); en móvil un drawer (Sheet) accesible desde el
 * botón de la topbar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar de escritorio */}
      <aside
        className={cn(
          'hidden shrink-0 border-r border-forest-line bg-surface-dark p-4 text-text-inverse transition-[width] duration-200 sm:block',
          collapsed ? 'w-[76px]' : 'w-60'
        )}
      >
        <div className="sticky top-4">
          <SidebarBody collapsed={collapsed} />
        </div>
      </aside>

      {/* Columna principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur">
          {/* Drawer móvil */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Abrir menú"
                className="inline-flex size-10 items-center justify-center rounded-xl border-2 border-border text-text transition-colors hover:border-forest sm:hidden"
              >
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="border-forest-line bg-surface-dark text-text-inverse"
            >
              <SidebarBody onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* Toggle de colapso (escritorio) */}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            aria-pressed={collapsed}
            className="hidden size-10 items-center justify-center rounded-xl border-2 border-border text-text transition-colors hover:border-forest sm:inline-flex"
          >
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </button>

          <img src="/logo.svg" alt="" width="240" height="110" className="h-6 w-auto sm:hidden" />
        </header>

        <main className="flex-1 overflow-x-hidden p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
