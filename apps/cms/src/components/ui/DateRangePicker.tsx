import { useState } from 'react';
import { Button } from './Button';
import { Calendar } from './Calendar';
import { DEFAULT_DATE_PRESETS, type DatePreset, type DateRange } from './dateRangePresets';
import { clampDate, formatDisplay, isISODate, today } from './dateUtils';
import { Field, fieldA11y, fieldLabelId, type FieldShellProps } from './FormField';
import { PickerTrigger } from './PickerTrigger';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { useFieldId } from './useFieldId';

export type { DatePreset, DateRange } from './dateRangePresets';

export interface DateRangePickerProps extends FieldShellProps {
  value: DateRange;
  onValueChange: (value: DateRange) => void;
  presets?: readonly DatePreset[];
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Muestra "Limpiar" para vaciar el rango. */
  clearable?: boolean;
  className?: string;
  'aria-label'?: string;
}

function describeRange({ from, to }: DateRange): string {
  if (!isISODate(from)) return '';
  const start = formatDisplay(from);
  return isISODate(to) && to !== from ? `${start} – ${formatDisplay(to)}` : start;
}

interface PresetListProps {
  presets: readonly DatePreset[];
  value: DateRange;
  onPick: (range: DateRange) => void;
}

function PresetList({ presets, value, onPick }: PresetListProps) {
  return (
    <div role="group" aria-label="Atajos" className="flex flex-wrap gap-1.5 sm:w-40 sm:flex-col sm:flex-nowrap">
      {presets.map((preset) => {
        const range = preset.range();
        const active = range.from === value.from && range.to === value.to;
        return (
          <Button
            key={preset.id}
            type="button"
            size="md"
            variant={active ? 'primary' : 'ghost'}
            aria-pressed={active}
            className="justify-start normal-case"
            onClick={() => onPick(range)}
          >
            {preset.label}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * Selector de rango de fechas con atajos (Hoy, Ayer, Últimos 7 días…).
 * Elige el inicio y luego el fin; si el segundo clic es anterior, se invierten.
 * Entrega `{ from, to }` en 'YYYY-MM-DD'.
 */
export function DateRangePicker({
  label,
  hint,
  error,
  required,
  id,
  value,
  onValueChange,
  presets = DEFAULT_DATE_PRESETS,
  min,
  max,
  placeholder = 'Elige un rango',
  disabled,
  clearable,
  className,
  'aria-label': ariaLabel,
}: DateRangePickerProps) {
  const fieldId = useFieldId(id);
  const [open, setOpen] = useState(false);
  /** Inicio ya elegido mientras se espera el fin. */
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [focused, setFocused] = useState(() => clampDate(isISODate(value.to) ? value.to : today(), min, max));

  function handleOpenChange(next: boolean) {
    if (next) {
      setFocused(clampDate(isISODate(value.to) ? value.to : today(), min, max));
      setPendingFrom(null);
      setPreview(null);
    }
    setOpen(next);
  }

  function commit(range: DateRange) {
    onValueChange(range);
    setOpen(false);
  }

  function pickDay(iso: string) {
    if (pendingFrom === null) {
      setPendingFrom(iso);
      return;
    }
    commit(iso < pendingFrom ? { from: iso, to: pendingFrom } : { from: pendingFrom, to: iso });
  }

  const shownFrom = pendingFrom ?? (isISODate(value.from) ? value.from : undefined);
  const shownTo = pendingFrom !== null ? undefined : isISODate(value.to) ? value.to : undefined;

  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} required={required} className={className}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <PickerTrigger
            id={fieldId}
            disabled={disabled}
            aria-label={label ? undefined : ariaLabel}
            aria-labelledby={label ? `${fieldLabelId(fieldId)} ${fieldId}` : undefined}
            display={describeRange(value)}
            placeholder={placeholder}
            {...fieldA11y(fieldId, error, hint)}
          />
        </PopoverTrigger>
        <PopoverContent
          aria-label={label ?? ariaLabel ?? 'Elegir rango de fechas'}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <PresetList presets={presets} value={value} onPick={commit} />
          <div className="mx-auto sm:mx-0">
            <p role="status" className="mb-1 text-xs text-text-muted">
              {pendingFrom ? 'Ahora elige el último día.' : 'Elige el primer día del rango.'}
            </p>
            <Calendar
              focused={focused}
              onFocusedChange={setFocused}
              onSelect={pickDay}
              from={shownFrom}
              to={shownTo}
              preview={preview ?? undefined}
              onPreviewChange={setPreview}
              min={min}
              max={max}
              autoFocusDay
            />
            {clearable && isISODate(value.from) && (
              <Button type="button" variant="ghost" className="mt-2" onClick={() => commit({ from: '', to: '' })}>
                Limpiar
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </Field>
  );
}
