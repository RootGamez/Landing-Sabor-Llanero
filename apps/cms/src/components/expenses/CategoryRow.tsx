import { CornerDownRight, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import type { ExpenseCategoryNode } from '@sabor/shared';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

interface CategoryRowProps {
  node: ExpenseCategoryNode;
  isChild: boolean;
  onEdit: (node: ExpenseCategoryNode) => void;
  onToggleActive: (node: ExpenseCategoryNode) => void;
  onDelete: (node: ExpenseCategoryNode) => void;
  onAddChild?: (node: ExpenseCategoryNode) => void;
}

const ICON_BUTTON =
  'inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-text-muted hover:bg-muted hover:text-text';

/** Una fila del árbol: color + nombre + uso, y las acciones de la categoría. */
export function CategoryRow({ node, isChild, onEdit, onToggleActive, onDelete, onAddChild }: CategoryRowProps) {
  const inUse = node.expenseCount > 0 || node.children.length > 0;
  return (
    <li className={cn('flex items-center gap-3 py-2', isChild && 'pl-6')}>
      {isChild && <CornerDownRight aria-hidden="true" className="size-4 shrink-0 text-text-muted" />}
      <span
        aria-hidden="true"
        className="size-4 shrink-0 rounded-full border border-forest/30 bg-border"
        style={node.color ? { backgroundColor: node.color } : undefined}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-semibold', node.isActive ? 'text-text' : 'text-text-muted line-through')}>
          {node.name}
        </p>
        <p className="text-xs text-text-muted">
          {node.expenseCount} {node.expenseCount === 1 ? 'gasto' : 'gastos'}
        </p>
      </div>
      {!node.isActive && <Badge variant="muted">Desactivada</Badge>}
      <div className="flex shrink-0">
        {onAddChild && (
          <button type="button" className={ICON_BUTTON} onClick={() => onAddChild(node)} aria-label={`Agregar subcategoría a ${node.name}`}>
            <Plus aria-hidden="true" className="size-4" />
          </button>
        )}
        <button type="button" className={ICON_BUTTON} onClick={() => onEdit(node)} aria-label={`Editar ${node.name}`}>
          <Pencil aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          className={ICON_BUTTON}
          onClick={() => onToggleActive(node)}
          aria-label={node.isActive ? `Desactivar ${node.name}` : `Activar ${node.name}`}
        >
          <Power aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          className={cn(ICON_BUTTON, 'hover:bg-sky-soft hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40')}
          onClick={() => onDelete(node)}
          disabled={inUse}
          aria-label={inUse ? `No se puede eliminar ${node.name}: está en uso, desactívala` : `Eliminar ${node.name}`}
          title={inUse ? 'Está en uso: desactívala en lugar de eliminarla' : undefined}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      </div>
    </li>
  );
}
