import { Ban, ReceiptText, Save, Undo2 } from 'lucide-react';
import { formatPEN } from '@sabor/shared';
import { Button } from '../ui/Button';

interface TableTabActionsProps {
  hasTab: boolean;
  hasLines: boolean;
  dirty: boolean;
  saving: boolean;
  newUnits: number;
  /** Total a cobrar (ya con descuento). */
  totalCents: number;
  /** Productos de la cuenta que ya no están en el menú (se cobran igual). */
  lockedCents: number;
  canVoid: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCharge: () => void;
  onVoid: () => void;
}

/**
 * Pie del ticket de una mesa. Una sola acción principal a la vez: con cambios
 * sin guardar, "Guardar pedido"; con la cuenta al día, "Cerrar mesa y cobrar".
 */
export function TableTabActions({
  hasTab,
  hasLines,
  dirty,
  saving,
  newUnits,
  totalCents,
  lockedCents,
  canVoid,
  onSave,
  onDiscard,
  onCharge,
  onVoid,
}: TableTabActionsProps) {
  return (
    <div className="flex flex-col gap-2">
      {lockedCents > 0 && (
        <p className="text-xs text-text-muted">
          Incluye {formatPEN(lockedCents)} de productos que ya no están en el menú.
        </p>
      )}
      {dirty ? (
        <>
          <p role="status" className="text-sm font-bold text-text">
            {hasLines
              ? `${newUnits > 0 ? `${newUnits} producto${newUnits === 1 ? '' : 's'} nuevo${newUnits === 1 ? '' : 's'}` : 'Cambios'} sin guardar`
              : 'Para dejar la mesa sin productos, anula la cuenta.'}
          </p>
          <Button size="lg" className="h-16 w-full text-lg" onClick={onSave} loading={saving} disabled={!hasLines}>
            <Save aria-hidden="true" />
            Guardar pedido
          </Button>
          {hasTab || hasLines ? (
            <Button variant="ghost" onClick={onDiscard} disabled={saving}>
              <Undo2 aria-hidden="true" />
              Descartar cambios
            </Button>
          ) : null}
        </>
      ) : hasTab ? (
        <>
          <Button size="lg" className="h-16 w-full text-lg" onClick={onCharge} disabled={totalCents <= 0}>
            <ReceiptText aria-hidden="true" />
            Cerrar mesa y cobrar
          </Button>
          {canVoid && (
            <Button variant="ghost" className="text-destructive" onClick={onVoid}>
              <Ban aria-hidden="true" />
              Anular cuenta
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-text-muted">Mesa libre: toca productos para tomar el pedido.</p>
          <Button size="lg" className="h-16 w-full text-lg" disabled>
            <Save aria-hidden="true" />
            Guardar pedido
          </Button>
        </>
      )}
    </div>
  );
}
