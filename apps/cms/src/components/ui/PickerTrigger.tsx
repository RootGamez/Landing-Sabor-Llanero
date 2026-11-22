import * as React from 'react';
import { CalendarDays, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fieldClassName } from './fieldStyles';

interface PickerTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Texto del valor actual; vacío muestra `placeholder`. */
  display: string;
  placeholder: string;
  icon?: LucideIcon;
}

/** Botón con aspecto de campo que abre un popover (fecha, rango, mes). */
export const PickerTrigger = React.forwardRef<HTMLButtonElement, PickerTriggerProps>(
  ({ display, placeholder, icon: Icon = CalendarDays, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-haspopup="dialog"
      className={cn(fieldClassName, 'flex cursor-pointer items-center gap-2 text-left', className)}
      {...props}
    >
      <Icon className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
      <span className={cn('flex-1 truncate tabular-nums', !display && 'text-text-muted')}>
        {display || placeholder}
      </span>
    </button>
  )
);
PickerTrigger.displayName = 'PickerTrigger';
