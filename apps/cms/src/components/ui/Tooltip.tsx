import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../../lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;

interface TooltipProps {
  /** Texto breve. En táctil no se ve: no pongas información imprescindible solo aquí. */
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

/**
 * Tooltip con teclado (aparece al enfocar) y `aria-describedby` automático.
 * `children` debe ser un único elemento enfocable (botón, enlace…); si es un
 * botón de solo ícono, dale además `aria-label`.
 */
export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={300} skipDelayDuration={150}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className={cn(
              'z-[70] max-w-xs rounded-lg bg-forest px-3 py-1.5 text-xs font-medium text-text-inverse shadow-glow data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0 motion-reduce:animate-none',
              className
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
