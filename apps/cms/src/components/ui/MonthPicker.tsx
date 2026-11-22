import { useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MONTHS, formatMonthLong, isPeriod, today } from './dateUtils';
import { Field, fieldA11y, fieldLabelId, type FieldShellProps } from './FormField';
import { PickerTrigger } from './PickerTrigger';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { useFieldId } from './useFieldId';

export interface MonthPickerProps extends FieldShellProps {
  /** 'YYYY-MM' o ''. */
  value: string;
  onValueChange: (value: string) => void;
  /** 'YYYY-MM' */
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

const MONTH_CHIP_CLASS =
  'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-semibold capitalize text-text transition-colors hover:bg-lime-soft disabled:cursor-not-allowed disabled:opacity-30 data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground';

const pad = (n: number) => String(n).padStart(2, '0');

interface MonthGridProps {
  year: number;
  value: string;
  min?: string;
  max?: string;
  onPick: (period: string) => void;
}

function MonthGrid({ year, value, min, max, onPick }: MonthGridProps) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {MONTHS.map((name, index) => {
        const period = `${year}-${pad(index + 1)}`;
        return (
          <button
            key={period}
            type="button"
            data-selected={period === value}
            aria-pressed={period === value}
            aria-label={formatMonthLong(period)}
            disabled={(!!min && period < min) || (!!max && period > max)}
            onClick={() => onPick(period)}
            className={cn(MONTH_CHIP_CLASS)}
          >
            {name.slice(0, 3)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Selector de mes/año ('YYYY-MM') con cuadrícula de 12 meses y flechas de año.
 * Sustituye a `<input type="month">`.
 */
export function MonthPicker({
  label,
  hint,
  error,
  required,
  id,
  value,
  onValueChange,
  min,
  max,
  placeholder = 'Elige un mes',
  disabled,
  className,
  'aria-label': ariaLabel,
}: MonthPickerProps) {
  const fieldId = useFieldId(id);
  const valid = isPeriod(value);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number((valid ? value : today()).slice(0, 4)));
  const navClass = 'inline-flex size-11 cursor-pointer items-center justify-center rounded-full hover:bg-muted';

  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} required={required} className={className}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) setYear(Number((valid ? value : today()).slice(0, 4)));
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <PickerTrigger
            id={fieldId}
            icon={CalendarRange}
            disabled={disabled}
            aria-label={label ? undefined : ariaLabel}
            aria-labelledby={label ? `${fieldLabelId(fieldId)} ${fieldId}` : undefined}
            display={valid ? formatMonthLong(value) : ''}
            placeholder={placeholder}
            className="capitalize"
            {...fieldA11y(fieldId, error, hint)}
          />
        </PopoverTrigger>
        <PopoverContent aria-label={label ?? ariaLabel ?? 'Elegir mes'} className="w-72">
          <div className="mb-1 flex items-center justify-between">
            <button type="button" className={navClass} aria-label="Año anterior" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <span aria-live="polite" className="font-display text-sm font-bold tabular-nums text-text">
              {year}
            </span>
            <button type="button" className={navClass} aria-label="Año siguiente" onClick={() => setYear((y) => y + 1)}>
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </div>
          <MonthGrid
            year={year}
            value={value}
            min={min}
            max={max}
            onPick={(period) => {
              onValueChange(period);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </Field>
  );
}
