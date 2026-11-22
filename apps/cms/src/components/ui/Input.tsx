import * as React from 'react';
import { cn } from '../../lib/utils';
import { fieldClassName } from './fieldStyles';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Input de texto estilizado (44 px de alto, estados invalid/disabled/read-only).
 * Para números usa `NumberField`; para fechas `DatePicker`/`MonthPicker`.
 * Marca el estado inválido con `aria-invalid`.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(fieldClassName, '[&::-webkit-search-cancel-button]:appearance-none', className)}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, ...props }, ref) => (
    <textarea ref={ref} rows={rows} className={cn(fieldClassName, 'resize-y', className)} {...props} />
  )
);
Textarea.displayName = 'Textarea';
