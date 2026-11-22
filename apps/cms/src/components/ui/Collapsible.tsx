import * as React from 'react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Collapsible = CollapsiblePrimitive.Root;

/** Disparador sin estilo propio: úsalo con `asChild` sobre tu propio botón. */
export const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

export const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>
>(({ className, ...props }, ref) => (
  <CollapsiblePrimitive.Content
    ref={ref}
    className={cn(
      'overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none',
      className
    )}
    {...props}
  />
));
CollapsibleContent.displayName = 'CollapsibleContent';

/** Botón de sección desplegable: 44 px, chevron que rota, foco visible global. */
export const CollapsibleSummary = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <CollapsiblePrimitive.Trigger
    ref={ref}
    className={cn(
      'group flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-text transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    {children}
    <ChevronDown
      className="size-4 shrink-0 text-text-muted transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
      aria-hidden="true"
    />
  </CollapsiblePrimitive.Trigger>
));
CollapsibleSummary.displayName = 'CollapsibleSummary';
