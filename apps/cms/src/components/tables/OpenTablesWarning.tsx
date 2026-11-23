import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { formatPEN, tableDisplayName } from '@sabor/shared';
import { useTableStatuses } from '../../hooks/useTables';

/**
 * Aviso al cerrar caja: las mesas con cuenta abierta NO entran en este cierre
 * (no se cobraron). Se pueden cobrar antes o quedan para la próxima caja.
 * Si la consulta falla no se muestra nada: el aviso no debe bloquear el cierre.
 */
export function OpenTablesWarning() {
  const { data } = useTableStatuses({ poll: false });
  const open = (data ?? []).filter((table) => table.openTab !== null);
  if (open.length === 0) return null;

  const totalCents = open.reduce((sum, table) => sum + (table.openTab?.totalCents ?? 0), 0);
  const names = open.map((table) => tableDisplayName(table.label)).join(', ');
  return (
    <div role="alert" className="flex gap-3 rounded-xl border-2 border-sky-strong bg-sky-soft p-3 text-sm text-text">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-sky-strong" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-bold">
          {open.length === 1 ? 'Hay 1 mesa ocupada' : `Hay ${open.length} mesas ocupadas`} sin cobrar ({formatPEN(totalCents)}): {names}.
        </p>
        <p>
          No se suman a este cierre. Cóbralas antes de cerrar o quedarán abiertas para la próxima caja.{' '}
          <Link to="/ventas/pos?modo=mesas" className="font-bold underline underline-offset-2">
            Ir a Mesas
          </Link>
        </p>
      </div>
    </div>
  );
}
