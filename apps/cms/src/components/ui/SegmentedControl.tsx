import * as RadioPrimitive from '@radix-ui/react-radio-group';
import { cn } from '../../lib/utils';
import { Field, fieldA11y, fieldLabelId, type FieldShellProps } from './FormField';
import type { ChoiceOption } from './RadioGroup';
import { useFieldId } from './useFieldId';

export interface SegmentedControlProps extends FieldShellProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly ChoiceOption[];
  disabled?: boolean;
  /** Opciones a todo el ancho (útil en móvil). */
  fullWidth?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Selector segmentado para 2–5 opciones excluyentes (período, rol, filtro de
 * estado). Semánticamente es un `radiogroup`: Tab entra una sola vez y las
 * flechas cambian la opción. Cada segmento mide 44 px de alto.
 */
export function SegmentedControl({
  label,
  hint,
  error,
  required,
  id,
  value,
  onValueChange,
  options,
  disabled,
  fullWidth,
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps) {
  const fieldId = useFieldId(id);
  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} required={required} group className={className}>
      <RadioPrimitive.Root
        id={fieldId}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        orientation="horizontal"
        aria-label={label ? undefined : ariaLabel}
        aria-labelledby={label ? fieldLabelId(fieldId) : undefined}
        {...fieldA11y(fieldId, error, hint)}
        className={cn(
          'inline-flex max-w-full flex-wrap gap-1 rounded-xl border-2 border-border bg-muted p-1',
          fullWidth && 'flex w-full'
        )}
      >
        {options.map((option) => (
          <RadioPrimitive.Item
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={cn(
              'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-bold text-text-muted transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
              fullWidth && 'flex-1'
            )}
          >
            {option.label}
          </RadioPrimitive.Item>
        ))}
      </RadioPrimitive.Root>
    </Field>
  );
}
