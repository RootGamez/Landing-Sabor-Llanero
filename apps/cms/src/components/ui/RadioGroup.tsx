import * as React from 'react';
import * as RadioPrimitive from '@radix-ui/react-radio-group';
import { cn } from '../../lib/utils';
import { Field, fieldA11y, fieldLabelId, type FieldShellProps } from './FormField';
import { useFieldId } from './useFieldId';

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioPrimitive.Item
    ref={ref}
    className={cn(
      "relative inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-forest bg-surface before:absolute before:-inset-2.5 before:content-[''] hover:bg-lime-soft aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    <RadioPrimitive.Indicator className="block size-3 rounded-full bg-primary" />
  </RadioPrimitive.Item>
));
RadioGroupItem.displayName = 'RadioGroupItem';

export interface RadioGroupProps extends FieldShellProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly ChoiceOption[];
  name?: string;
  disabled?: boolean;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

function RadioRow({ option, groupId, index }: { option: ChoiceOption; groupId: string; index: number }) {
  const itemId = `${groupId}-${index}`;
  return (
    <label
      htmlFor={itemId}
      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 border-border bg-surface px-3 py-2 text-sm text-text has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[[data-state=checked]]:border-primary"
    >
      <RadioGroupItem
        id={itemId}
        value={option.value}
        disabled={option.disabled}
        aria-labelledby={`${itemId}-label`}
        aria-describedby={option.description ? `${itemId}-desc` : undefined}
      />
      <span className="flex flex-col">
        <span id={`${itemId}-label`} className="font-semibold">
          {option.label}
        </span>
        {option.description && (
          <span id={`${itemId}-desc`} className="text-xs text-text-muted">
            {option.description}
          </span>
        )}
      </span>
    </label>
  );
}

/**
 * Grupo de radios (Radix): una sola parada de Tab, flechas para moverse.
 * La etiqueta del grupo nombra a todo el `radiogroup` (`aria-labelledby`).
 */
export function RadioGroup({
  label,
  hint,
  error,
  required,
  id,
  value,
  onValueChange,
  options,
  name,
  disabled,
  orientation = 'vertical',
  className,
}: RadioGroupProps) {
  const fieldId = useFieldId(id);
  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} required={required} group className={className}>
      <RadioPrimitive.Root
        id={fieldId}
        value={value}
        onValueChange={onValueChange}
        name={name}
        disabled={disabled}
        required={required}
        orientation={orientation}
        aria-labelledby={label ? fieldLabelId(fieldId) : undefined}
        {...fieldA11y(fieldId, error, hint)}
        className={cn('flex gap-2', orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap')}
      >
        {options.map((option, index) => (
          <RadioRow key={option.value} option={option} groupId={fieldId} index={index} />
        ))}
      </RadioPrimitive.Root>
    </Field>
  );
}
