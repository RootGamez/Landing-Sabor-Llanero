import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fieldA11y } from './FormField';
import { useFieldId } from './useFieldId';

/** Caja de 24 px; el área táctil de 44 px la aporta la fila (`CheckboxField`) o el `before:` invisible. */
export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "relative inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-forest bg-surface text-primary-foreground transition-colors before:absolute before:-inset-2.5 before:content-[''] hover:bg-lime-soft data-[state=checked]:bg-primary data-[state=indeterminate]:bg-primary aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center">
      {props.checked === 'indeterminate' ? (
        <Minus className="size-4" strokeWidth={3} aria-hidden="true" />
      ) : (
        <Check className="size-4" strokeWidth={3} aria-hidden="true" />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = 'Checkbox';

interface CheckboxFieldProps
  extends Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, 'children'> {
  label: string;
  description?: string;
  error?: string;
  /** `card`: fila con borde, igual que los `SwitchField` de formularios. */
  variant?: 'inline' | 'card';
}

/**
 * Casilla con etiqueta clicable (fila ≥ 44 px). El nombre accesible es solo
 * `label`; `description` y `error` van por `aria-describedby`.
 */
export function CheckboxField({
  label,
  description,
  error,
  variant = 'inline',
  id,
  className,
  ...props
}: CheckboxFieldProps) {
  const fieldId = useFieldId(id);
  const descId = `${fieldId}-hint`;
  const a11y = fieldA11y(fieldId, error, description);
  return (
    <div className={className}>
      <label
        htmlFor={fieldId}
        className={cn(
          'flex min-h-11 cursor-pointer items-center gap-3 text-sm text-text has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
          variant === 'card' && 'rounded-xl2 border-2 border-border bg-surface p-4'
        )}
      >
        <Checkbox id={fieldId} {...a11y} aria-labelledby={`${fieldId}-label`} {...props} />
        <span className="flex flex-col">
          <span id={`${fieldId}-label`} className="font-semibold">
            {label}
          </span>
          {description && !error && (
            <span id={descId} className="text-xs font-normal text-text-muted">
              {description}
            </span>
          )}
        </span>
      </label>
      {error && (
        <p id={`${fieldId}-error`} role="alert" className="mt-1 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
