import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Field, fieldA11y, fieldLabelId } from './FormField';
import { fieldClassName } from './fieldStyles';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import type { SelectOption, SelectProps } from './Select';
import { useFieldId } from './useFieldId';

export interface ComboboxProps extends Omit<SelectProps, 'name'> {
  searchPlaceholder?: string;
  emptyText?: string;
}

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface ListProps {
  listId: string;
  options: readonly SelectOption[];
  value: string;
  activeIndex: number;
  emptyText: string;
  listLabel: string;
  onActivate: (index: number) => void;
  onPick: (option: SelectOption) => void;
}

function ComboboxList({ listId, options, value, activeIndex, emptyText, listLabel, onActivate, onPick }: ListProps) {
  if (options.length === 0) {
    return (
      <p role="status" className="px-3 py-4 text-center text-sm text-text-muted">
        {emptyText}
      </p>
    );
  }
  return (
    <ul id={listId} role="listbox" aria-label={listLabel} className="max-h-64 overflow-y-auto p-1">
      {options.map((option, index) => (
        <li
          key={option.value}
          id={`${listId}-${index}`}
          role="option"
          aria-selected={option.value === value}
          aria-disabled={option.disabled || undefined}
          data-highlighted={index === activeIndex ? '' : undefined}
          data-disabled={option.disabled ? '' : undefined}
          onMouseMove={() => onActivate(index)}
          onMouseDown={(event) => {
            event.preventDefault();
            if (!option.disabled) onPick(option);
          }}
          className="relative flex min-h-11 cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 pr-9 text-sm text-text data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-lime-soft data-[highlighted]:text-forest aria-selected:font-bold"
        >
          {option.label}
          {option.value === value && <Check className="absolute right-3 size-4" aria-hidden="true" />}
        </li>
      ))}
    </ul>
  );
}

/**
 * Select con búsqueda (patrón combobox + listbox sobre Popover). El campo de
 * búsqueda conserva el foco y `aria-activedescendant` apunta a la opción
 * resaltada. Teclado: flechas, Inicio/Fin, Enter elige, Esc cierra.
 */
export function Combobox({
  label,
  hint,
  error,
  required,
  id,
  value,
  onValueChange,
  options,
  placeholder = 'Selecciona…',
  searchPlaceholder = 'Buscar…',
  emptyText = 'Sin resultados.',
  disabled,
  className,
  'aria-label': ariaLabel,
}: ComboboxProps) {
  const fieldId = useFieldId(id);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    return needle ? options.filter((o) => normalize(o.label).includes(needle)) : options;
  }, [options, query]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, listId]);

  function handleOpenChange(next: boolean) {
    if (next) {
      setQuery('');
      setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
    }
    setOpen(next);
  }

  function pick(option: SelectOption) {
    onValueChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const last = filtered.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: activeIndex >= last ? 0 : activeIndex + 1,
      ArrowUp: activeIndex <= 0 ? last : activeIndex - 1,
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActiveIndex(moves[event.key] ?? 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option && !option.disabled) pick(option);
    }
  }

  const selected = options.find((o) => o.value === value);

  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} required={required} className={className}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            id={fieldId}
            type="button"
            disabled={disabled}
            aria-label={label ? undefined : ariaLabel}
            aria-labelledby={label ? `${fieldLabelId(fieldId)} ${fieldId}` : undefined}
            className={cn(fieldClassName, 'flex cursor-pointer items-center justify-between gap-2 text-left')}
            {...fieldA11y(fieldId, error, hint)}
          >
            <span className={cn('truncate', !selected && 'text-text-muted/70')}>{selected?.label ?? placeholder}</span>
            <ChevronDown className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          aria-label={label ?? ariaLabel ?? 'Buscar y elegir'}
          className="w-(--radix-popover-trigger-width) min-w-64 p-0"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById(`${listId}-search`)?.focus();
          }}
        >
          <div className="relative border-b-2 border-border p-2">
            <Search className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              id={`${listId}-search`}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={filtered.length > 0 ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={filtered.length > 0 ? `${listId}-${activeIndex}` : undefined}
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className={cn(fieldClassName, 'pl-9')}
            />
          </div>
          <ComboboxList
            listId={listId}
            options={filtered}
            value={value}
            activeIndex={activeIndex}
            emptyText={emptyText}
            listLabel={label ?? ariaLabel ?? 'Opciones'}
            onActivate={setActiveIndex}
            onPick={pick}
          />
        </PopoverContent>
      </Popover>
    </Field>
  );
}
