import { useEffect, type RefObject } from 'react';

interface PosShortcutsOptions {
  searchRef: RefObject<HTMLInputElement | null>;
  canCharge: boolean;
  onCharge: () => void;
  /** `true` mientras hay un diálogo abierto: los atajos de página no deben dispararse debajo. */
  disabled: boolean;
}

const EDITABLE = 'input, textarea, select, [contenteditable="true"]';
const INTERACTIVE = `${EDITABLE}, button, a, summary, [role="button"], [role="radio"]`;

/**
 * Atajos del POS: `/` enfoca el buscador y `Enter` abre el cobro. `Enter` solo
 * actúa si el foco NO está sobre un control (un botón enfocado ya usa Enter para
 * activarse); `Esc` lo resuelven los diálogos (Radix) y el buscador.
 */
export function usePosShortcuts({ searchRef, canCharge, onCharge, disabled }: PosShortcutsOptions) {
  useEffect(() => {
    if (disabled) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;

      if (event.key === '/' && !target?.closest(EDITABLE)) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === 'Enter' && canCharge && !target?.closest(INTERACTIVE)) {
        event.preventDefault();
        onCharge();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchRef, canCharge, onCharge, disabled]);
}
