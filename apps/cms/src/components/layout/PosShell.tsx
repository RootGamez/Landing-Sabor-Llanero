import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DoorOpen } from 'lucide-react';
import { BRAND } from '@sabor/shared';
import { useSessionStore } from '../../store/sessionStore';

/**
 * Layout a pantalla completa del POS (D14): sin sidebar, barra superior mínima
 * y botón "Salir" que vuelve al dashboard. Pensado para uso táctil en
 * mostrador (objetivos >= 44px, sin zoom por doble toque) y escritorio.
 * Altura `dvh` para que la barra de direcciones móvil no corte el contenido;
 * el scroll vive en `<main>`, no en la página.
 */
export function PosShell({ children }: { children: ReactNode }) {
  const userName = useSessionStore((s) => s.user?.name);

  return (
    <div className="flex h-dvh touch-manipulation flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-forest-line bg-surface-dark px-3 text-text-inverse sm:px-4">
        <img src="/logo.svg" alt="" width="240" height="110" className="h-7 w-auto shrink-0" />
        <span className="sr-only">{BRAND.name}</span>
        <span className="font-display text-sm font-bold uppercase tracking-wide">Punto de venta</span>
        <span className="flex-1" />
        {userName && (
          <span className="hidden truncate text-sm text-text-inverse/70 sm:block">{userName}</span>
        )}
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-forest-line px-4 text-sm font-bold uppercase tracking-wide text-text-inverse outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-dark"
        >
          <DoorOpen className="size-4" aria-hidden="true" />
          Salir
        </Link>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">{children}</main>
    </div>
  );
}
