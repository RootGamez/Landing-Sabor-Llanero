import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DoorOpen, LogOut } from 'lucide-react';
import { BRAND } from '@sabor/shared';
import { homePathForRole } from '../../lib/homePath';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useSessionStore } from '../../store/sessionStore';

const EXIT_BUTTON =
  'inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-forest-line px-4 text-sm font-bold uppercase tracking-wide text-text-inverse outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-dark';

/**
 * Layout a pantalla completa del POS (D14): sin sidebar, barra superior mínima
 * y botón "Salir" que vuelve al inicio del rol (el cajero, que no tiene dashboard, cierra sesión). Pensado para uso táctil en
 * mostrador (objetivos >= 44px, sin zoom por doble toque) y escritorio.
 * Altura `dvh` para que la barra de direcciones móvil no corte el contenido;
 * el scroll vive en `<main>`, no en la página.
 */
export function PosShell({ children }: { children: ReactNode }) {
  const userName = useSessionStore((s) => s.user?.name);
  const role = useSessionStore((s) => s.user?.role);
  const logout = useSessionStore((s) => s.logout);
  const isCashier = role === 'cashier';
  const [confirmingLogout, setConfirmingLogout] = useState(false);

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
        {isCashier ? (
          <button type="button" onClick={() => setConfirmingLogout(true)} className={EXIT_BUTTON}>
            <LogOut className="size-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        ) : (
          <Link to={homePathForRole(role)} className={EXIT_BUTTON}>
            <DoorOpen className="size-4" aria-hidden="true" />
            Salir
          </Link>
        )}
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">{children}</main>
      <ConfirmDialog
        open={confirmingLogout}
        title="¿Cerrar sesión?"
        description="Si tienes una venta a medias en el ticket, se perderá. La caja seguirá abierta."
        confirmLabel="Sí, cerrar sesión"
        onConfirm={() => logout()}
        onCancel={() => setConfirmingLogout(false)}
      />
    </div>
  );
}
