import { useState, type FormEvent } from 'react';
import type { ExpenseCategoryNode } from '@sabor/shared';
import { useFieldErrors } from '../../hooks/useFieldErrors';
import { useMutation } from '../../hooks/useMutation';
import { createExpenseCategory, updateExpenseCategory } from '../../lib/expensesApi';
import { cn } from '../../lib/utils';
import { toastSuccess } from '../../store/toastStore';
import { Button } from '../ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { TextField } from '../ui/FormField';
import { Select } from '../ui/Select';

const NAME_MAX = 60;
const COLOR_PRESETS = [
  { hex: '#cf142b', name: 'Rojo' },
  { hex: '#e6b800', name: 'Amarillo' },
  { hex: '#2e7d4f', name: 'Verde' },
  { hex: '#00247d', name: 'Azul' },
  { hex: '#0a8f9c', name: 'Turquesa' },
  { hex: '#8a4fff', name: 'Violeta' },
  { hex: '#e0762b', name: 'Naranja' },
  { hex: '#5b5f6b', name: 'Gris' },
] as const;

export interface CategoryDialogTarget {
  /** Categoría que se edita; `null` = crear. */
  editing: ExpenseCategoryNode | null;
  /** Padre preseleccionado al crear una subcategoría. */
  parentId: number | null;
}

interface CategoryDialogProps {
  target: CategoryDialogTarget;
  roots: readonly ExpenseCategoryNode[];
  onClose: () => void;
  onSaved: () => void;
}

function ColorPicker({ value, onChange }: { value: string | null; onChange: (color: string | null) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">Color (opcional)</legend>
      <div className="flex flex-wrap gap-2">
        {COLOR_PRESETS.map(({ hex: color, name: colorName }) => (
          <button
            key={color}
            type="button"
            aria-label={`Color ${colorName}`}
            aria-pressed={value?.toLowerCase() === color}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              'size-11 cursor-pointer rounded-full border-2',
              value?.toLowerCase() === color ? 'border-forest ring-2 ring-lime' : 'border-border',
            )}
          />
        ))}
        <Button variant="ghost" size="sm" className="h-11" onClick={() => onChange(null)} disabled={value === null}>
          Sin color
        </Button>
      </div>
    </fieldset>
  );
}

/** Crear o editar una categoría de gastos (nombre, padre, color). */
export function CategoryDialog({ target, roots, onClose, onSaved }: CategoryDialogProps) {
  const { editing } = target;
  const [name, setName] = useState(editing?.name ?? '');
  const [parentId, setParentId] = useState<number | null>(editing ? editing.parentId : target.parentId);
  const [color, setColor] = useState<string | null>(editing?.color ?? null);
  const { mutate: save, loading } = useMutation(async () => {
    const input = { name: name.trim(), parentId, color };
    return editing ? updateExpenseCategory(editing.id, input) : createExpenseCategory(input);
  });
  const { error, touch, validate } = useFieldErrors({ 'cat-name': name.trim() ? null : 'Escribe un nombre' });

  // Solo raíces pueden ser padre; una categoría con hijas no puede volverse subcategoría.
  const parentOptions = roots.filter((root) => root.id !== editing?.id);
  const canHaveParent = !editing || editing.children.length === 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    const saved = await save();
    if (!saved) return;
    toastSuccess(editing ? 'Categoría actualizada' : 'Categoría creada');
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>{editing ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
        <DialogDescription>Las subcategorías tienen un solo nivel: una categoría principal y sus hijas.</DialogDescription>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <TextField
            id="cat-name"
            label="Nombre"
            value={name}
            maxLength={NAME_MAX}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
            onBlur={() => touch('cat-name')}
            error={error('cat-name')}
          />
          {canHaveParent && (
            <Select
              id="cat-parent"
              label="Categoría principal"
              value={parentId === null ? '' : String(parentId)}
              onValueChange={(next) => setParentId(next ? Number(next) : null)}
              options={[
                { value: '', label: 'Ninguna (es principal)' },
                ...parentOptions.map((root) => ({ value: String(root.id), label: root.name })),
              ]}
            />
          )}
          <ColorPicker value={color} onChange={setColor} />
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent" loading={loading}>
              Guardar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
