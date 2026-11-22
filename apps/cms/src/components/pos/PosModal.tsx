import { useRef, type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

type Placement = 'center' | 'bottom' | 'right';

const PLACEMENT_CLASS: Record<Placement, string> = {
  center:
    'left-1/2 top-1/2 max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl2 border-2 data-[state=open]:zoom-in-95',
  bottom:
    'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-xl2 border-t-2 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
  right:
    'inset-y-0 right-0 w-full max-w-md border-l-2 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
};

interface PosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Texto de apoyo para lectores de pantalla; si falta se declara explícitamente sin descripción. */
  description?: string;
  placement?: Placement;
  children: ReactNode;
}

/**
 * Diálogo del POS sobre Radix (foco atrapado, Esc, restauración de foco y
 * `aria-modal` incluidos). Propio del POS porque el botón de cierre del `Dialog`
 * genérico mide 32px y aquí el objetivo táctil mínimo es 44px; además agrega
 * las variantes "hoja inferior" (móvil) y "panel derecho".
 */
export function PosModal({
  open,
  onOpenChange,
  title,
  description,
  placement = 'center',
  children,
}: PosModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  /** Foco inicial en el control marcado `data-autofocus` (no en "Cerrar"), para que Enter confirme la acción principal. */
  function focusPrimaryControl(event: Event) {
    const target = contentRef.current?.querySelector<HTMLElement>('[data-autofocus]');
    if (!target) return;
    event.preventDefault();
    target.focus();
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-onyx/60 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          ref={contentRef}
          onOpenAutoFocus={focusPrimaryControl}
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed z-50 flex flex-col border-border bg-surface shadow-glow duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none',
            PLACEMENT_CLASS[placement],
          )}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-3">
            <div className="min-w-0">
              <DialogPrimitive.Title className="font-display text-lg font-bold leading-tight text-text">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-0.5 text-sm text-text-muted">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-text transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <X className="size-5" aria-hidden="true" />
              <span className="sr-only">Cerrar</span>
            </DialogPrimitive.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
