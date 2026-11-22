import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Plus } from 'lucide-react';
import { findCategoryByName, normalizeLabel } from '@sabor/shared';
import { cn } from '../../lib/utils';
import { Field, fieldA11y } from '../ui/FormField';
import { fieldClassName } from '../ui/fieldStyles';
import { optionClassName, popupClassName } from '../ui/popupStyles';
import {
  CATEGORY_NAME_MAX,
  cleanTypeName,
  selectionFromText,
  selectionLabel,
  type CategorySelection,
} from './categorySelection';
import type { CategoryOption } from './expenseUtils';

interface CategoryComboboxProps {
  id: string;
  label: string;
  /** Categorías que se pueden elegir (activas). */
  categories: readonly CategoryOption[];
  value: CategorySelection | null;
  onChange: (value: CategorySelection | null) => void;
  onBlur?: () => void;
  error?: string;
}

type ListOption = { key: string; kind: 'category'; category: CategoryOption } | { key: string; kind: 'create'; name: string };

/** Categorías que contienen lo escrito, más la opción de crear un tipo nuevo si no hay una igual. */
function buildOptions(categories: readonly CategoryOption[], query: string): ListOption[] {
  const needle = normalizeLabel(query);
  const matches = categories.filter((c) => normalizeLabel(c.label).includes(needle));
  const options: ListOption[] = matches.map((category) => ({ key: `c-${category.id}`, kind: 'category', category }));
  const name = cleanTypeName(query);
  if (name !== '' && !findCategoryByName(categories, name)) options.push({ key: 'create', kind: 'create', name });
  return options;
}

/**
 * Selector de categoría con escritura libre (patrón combobox de ARIA, lista
 * editable): el foco se queda en el campo y la lista se maneja con las flechas.
 * Lo escrito que no coincide con ninguna categoría se ofrece como "tipo nuevo".
 */
export function CategoryCombobox({ id, label, categories, value, onChange, onBlur, error }: CategoryComboboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  // -1 = nadie navegó con las flechas: Enter envía el formulario con lo escrito en vez de elegir la primera fila.
  const [activeIndex, setActiveIndex] = useState(-1);

  const text = query ?? selectionLabel(value, categories);
  const options = useMemo(() => buildOptions(categories, query ?? ''), [categories, query]);
  const optionId = (index: number) => `${id}-option-${index}`;

  function choose(option: ListOption) {
    onChange(option.kind === 'category' ? { kind: 'existing', id: option.category.id } : { kind: 'new', name: option.name });
    setQuery(null);
    setOpen(false);
  }

  function handleInput(next: string) {
    setQuery(next);
    setOpen(true);
    setActiveIndex(-1);
    onChange(selectionFromText(next, categories));
  }

  const expanded = open && options.length > 0;
  const active = activeIndex < 0 ? -1 : Math.min(activeIndex, options.length - 1);

  function moveActive(step: 1 | -1) {
    if (!expanded) return setOpen(true);
    const last = options.length - 1;
    setActiveIndex(active === -1 ? (step === 1 ? 0 : last) : (active + step + options.length) % options.length);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' && expanded && options[active]) {
      event.preventDefault();
      choose(options[active]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  useEffect(() => {
    if (active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const activeOption = expanded && active >= 0 ? optionId(active) : undefined;
  const newName = value?.kind === 'new' ? value.name : null;

  return (
    <Field label={label} htmlFor={id} error={error}>
      <Popover.Root open={expanded} onOpenChange={setOpen}>
        <Popover.Anchor asChild>
          <div className="relative">
            <input
              id={id}
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={expanded}
              aria-controls={expanded ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={activeOption}
              autoComplete="off"
              maxLength={CATEGORY_NAME_MAX}
              placeholder="Elige o escribe un tipo nuevo"
              value={text}
              onChange={(event) => handleInput(event.target.value)}
              onKeyDown={handleKeyDown}
              onClick={() => setOpen(true)}
              onBlur={() => {
                setQuery(null);
                setOpen(false);
                onBlur?.();
              }}
              {...fieldA11y(id, error)}
              className={cn(fieldClassName, 'pr-11')}
            />
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            role="presentation"
            sideOffset={6}
            align="start"
            collisionPadding={12}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.target === inputRef.current && event.preventDefault()}
            // Con el foco en el campo: tocar una opción no debe quitárselo.
            onMouseDown={(event) => event.preventDefault()}
            className={cn(popupClassName, 'max-h-64 w-[var(--radix-popover-trigger-width)] overflow-y-auto p-1')}
          >
            <ul id={listId} role="listbox" aria-label={label}>
              {options.map((option, index) => (
                // Patrón combobox de ARIA: el teclado se maneja en el campo (aria-activedescendant), no en cada opción.
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                <li
                  key={option.key}
                  id={optionId(index)}
                  role="option"
                  aria-selected={option.kind === 'category' && value?.kind === 'existing' && value.id === option.category.id}
                  data-highlighted={index === active ? '' : undefined}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                  className={optionClassName}
                >
                  {option.kind === 'create' ? (
                    <>
                      <Plus aria-hidden="true" className="size-4 shrink-0" />
                      <span className="min-w-0 truncate">
                        Usar «<strong>{option.name}</strong>» como nuevo tipo
                      </span>
                    </>
                  ) : (
                    <span className="min-w-0 truncate">{option.category.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <p aria-live="polite" className={cn('text-xs font-semibold text-forest', newName === null && 'sr-only')}>
        {newName === null ? '' : `Se creará el tipo nuevo «${newName}» al guardar.`}
      </p>
    </Field>
  );
}
