import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '../../lib/utils';
import { fieldA11y } from './FormField';
import { useFieldId } from './useFieldId';

/** Interruptor de 28×48 px con área táctil ampliada (`before:`) hasta 44 px de alto. */
export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-forest bg-muted transition-colors before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block size-4 translate-x-1 rounded-full bg-forest shadow transition-transform data-[state=checked]:translate-x-6 data-[state=checked]:bg-primary-foreground motion-reduce:transition-none" />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

interface SwitchFieldProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>, 'children'> {
  label: string;
  description?: string;
  error?: string;
  /** `card`: fila con borde (formularios); `inline`: sin marco. */
  variant?: 'inline' | 'card';
}

/**
 * Interruptor con etiqueta y descripción. Toda la fila es clicable; el nombre
 * accesible es `label` y la descripción se anuncia aparte (`aria-describedby`).
 */
export function SwitchField({
  label,
  description,
  error,
  variant = 'card',
  id,
  className,
  ...props
}: SwitchFieldProps) {
  const fieldId = useFieldId(id);
  const a11y = fieldA11y(fieldId, error, description);
  return (
    <div className={className}>
      <label
        htmlFor={fieldId}
        className={cn(
          'flex min-h-11 cursor-pointer items-center justify-between gap-3 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
          variant === 'card' && 'rounded-xl2 border-2 border-border bg-surface p-4'
        )}
      >
        <span className="flex flex-col">
          <span id={`${fieldId}-label`} className="text-sm font-semibold text-text">
            {label}
          </span>
          {description && !error && (
            <span id={`${fieldId}-hint`} className="text-xs text-text-muted">
              {description}
            </span>
          )}
        </span>
        <Switch id={fieldId} {...a11y} aria-labelledby={`${fieldId}-label`} {...props} />
      </label>
      {error && (
        <p id={`${fieldId}-error`} role="alert" className="mt-1 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
