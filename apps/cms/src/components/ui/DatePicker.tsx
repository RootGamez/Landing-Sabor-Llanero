import { useState } from 'react';
import { Button } from './Button';
import { Calendar } from './Calendar';
import { clampDate, formatDisplay, isISODate, today } from './dateUtils';
import { Field, fieldA11y, fieldLabelId, type FieldShellProps } from './FormField';
import { PickerTrigger } from './PickerTrigger';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { useFieldId } from './useFieldId';

export interface DatePickerProps extends FieldShellProps {
  /** 'YYYY-MM-DD' o '' si no hay fecha. */
  value: string;
  onValueChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Muestra "Borrar" para dejar el campo vacío. */
  clearable?: boolean;
  name?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Selector de fecha: popover con calendario propio (semana desde lunes, en
 * español). Entrega siempre 'YYYY-MM-DD'. Enter/Espacio abre; flechas mueven
 * el día; Esc cierra devolviendo el foco al campo.
 */
export function DatePicker({
  label,
  hint,
  error,
  required,
  id,
  value,
  onValueChange,
  min,
  max,
  placeholder = 'Elige una fecha',
  disabled,
  clearable,
  name,
  className,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const fieldId = useFieldId(id);
  const [open, setOpen] = useState(false);
  const valid = isISODate(value);
  const [focused, setFocused] = useState(() => clampDate(valid ? value : today(), min, max));

  function handleOpenChange(next: boolean) {
    if (next) setFocused(clampDate(valid ? value : today(), min, max));
    setOpen(next);
  }

  function pick(iso: string) {
    onValueChange(iso);
    setOpen(false);
  }

  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} required={required} className={className}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <PickerTrigger
            id={fieldId}
            disabled={disabled}
            aria-label={label ? undefined : ariaLabel}
            aria-labelledby={label ? `${fieldLabelId(fieldId)} ${fieldId}` : undefined}
            display={valid ? formatDisplay(value) : ''}
            placeholder={placeholder}
            {...fieldA11y(fieldId, error, hint)}
          />
        </PopoverTrigger>
        <PopoverContent
          aria-label={label ?? ariaLabel ?? 'Elegir fecha'}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <Calendar
            focused={focused}
            onFocusedChange={setFocused}
            onSelect={pick}
            from={valid ? value : undefined}
            min={min}
            max={max}
            autoFocusDay
          />
          <div className="mt-2 flex justify-between gap-2 border-t-2 border-border pt-2">
            <Button type="button" variant="ghost" size="md" disabled={clampDate(today(), min, max) !== today()} onClick={() => pick(today())}>
              Hoy
            </Button>
            {clearable && valid && (
              <Button type="button" variant="ghost" size="md" onClick={() => pick('')}>
                Borrar
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {name && <input type="hidden" name={name} value={value} />}
    </Field>
  );
}
