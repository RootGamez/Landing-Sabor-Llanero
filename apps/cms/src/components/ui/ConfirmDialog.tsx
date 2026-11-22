import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';

export interface ConfirmOptions {
  title: string;
  description?: string;
  /** Texto del botón de acción (por defecto "Confirmar"). */
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` para acciones destructivas (por defecto); `primary` para confirmaciones neutras. */
  tone?: 'danger' | 'primary';
}

interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmación modal accesible (reemplaza a `window.confirm`): foco atrapado,
 * Esc cancela y el foco vuelve al elemento que la originó.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !loading && onCancel()}>
      <DialogContent {...(description ? {} : { 'aria-describedby': undefined })}>
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const FOCUS_WATCH_MS = 5000;
const FOCUS_POLL_MS = 150;

/** Enfoca el contenido principal (destino estable) cuando el botón que abrió el diálogo ya no existe. */
function focusMainContent() {
  const main = document.querySelector<HTMLElement>('main');
  if (!main) return;
  main.setAttribute('tabindex', '-1');
  main.focus({ preventScroll: true });
}

/**
 * Tras confirmar, la acción suele recargar la lista y el botón que abrió el
 * diálogo desaparece; sin esto el foco caería en <body> (WCAG 2.4.3).
 */
function watchFocusTarget(trigger: Element | null) {
  if (!(trigger instanceof HTMLElement)) return () => undefined;
  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    if (!trigger.isConnected) {
      window.clearInterval(timer);
      if (document.activeElement === document.body || document.activeElement === null) focusMainContent();
    } else if (Date.now() - startedAt > FOCUS_WATCH_MS) {
      window.clearInterval(timer);
    }
  }, FOCUS_POLL_MS);
  return () => window.clearInterval(timer);
}

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Monta un único `ConfirmDialog` para toda la app; se usa con `useConfirm()`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const trigger = useRef<Element | null>(null);
  const stopWatching = useRef<() => void>(() => undefined);

  useEffect(() => () => stopWatching.current(), []);

  const confirm = useCallback<ConfirmFn>((next) => {
    resolver.current?.(false);
    trigger.current = document.activeElement;
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    if (value) {
      stopWatching.current();
      stopWatching.current = watchFocusTarget(trigger.current);
    }
    setOpen(false);
  }, []);

  const dialogProps = useMemo(() => options ?? { title: '' }, [options]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        {...dialogProps}
        open={open}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

/** `if (!(await confirm({ title: '¿Eliminar…?' }))) return;` — resuelve `true` solo si el usuario acepta. */
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>.');
  return confirm;
}
