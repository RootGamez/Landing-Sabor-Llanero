import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Field, fieldA11y, type FieldShellProps } from './FormField';
import { fieldClassName } from './fieldStyles';
import { optionClassName, popupClassName } from './popupStyles';
import { useFieldId } from './useFieldId';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends FieldShellProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Radix no admite `value=""` en un ítem; la opción "vacía" (p. ej. "Todos") viaja con este centinela. */
const EMPTY_VALUE = '__empty__';

const encodeValue = (value: string) => (value === '' ? EMPTY_VALUE : value);
const decodeValue = (value: string) => (value === EMPTY_VALUE ? '' : value);

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      fieldClassName,
      'flex cursor-pointer items-center justify-between gap-2 text-left data-[placeholder]:text-text-muted/70 [&>span]:truncate',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

function SelectList({ options }: { options: readonly SelectOption[] }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={6}
        collisionPadding={12}
        className={cn(popupClassName, 'min-w-(--radix-select-trigger-width) overflow-hidden')}
      >
        <SelectPrimitive.Viewport className="max-h-[min(20rem,var(--radix-select-content-available-height))] p-1">
          {options.map((option) => (
            <SelectPrimitive.Item
              key={option.value}
              value={encodeValue(option.value)}
              disabled={option.disabled}
              className={cn(optionClassName, 'pr-9')}
            >
              <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              <SelectPrimitive.ItemIndicator className="absolute right-3">
                <Check className="size-4" aria-hidden="true" />
              </SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>
          ))}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

/**
 * Select accesible (Radix) integrado con `Field`: etiqueta, ayuda, error y
 * `aria-describedby`. Teclado: flechas, Inicio/Fin, escritura rápida, Esc.
 */
export function Select({
  label,
  hint,
  error,
  required,
  id,
  value,
  onValueChange,
  options,
  placeholder = 'Selecciona…',
  name,
  disabled,
  className,
  'aria-label': ariaLabel,
}: SelectProps) {
  const fieldId = useFieldId(id);
  const hasEmptyOption = options.some((o) => o.value === '');
  const current = value === '' && hasEmptyOption ? EMPTY_VALUE : value;
  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} required={required} className={className}>
      <SelectPrimitive.Root
        value={current}
        onValueChange={(next) => onValueChange(decodeValue(next))}
        name={name}
        disabled={disabled}
        required={required}
      >
        <SelectTrigger id={fieldId} aria-label={label ? undefined : ariaLabel} {...fieldA11y(fieldId, error, hint)}>
          <SelectPrimitive.Value placeholder={placeholder} />
        </SelectTrigger>
        <SelectList options={options} />
      </SelectPrimitive.Root>
    </Field>
  );
}
