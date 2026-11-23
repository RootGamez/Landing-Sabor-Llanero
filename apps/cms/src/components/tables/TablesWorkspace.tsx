import { Link } from 'react-router-dom';
import { PencilRuler, RefreshCw } from 'lucide-react';
import { PLAN_MIN_ROWS, type DiningTableStatus } from '@sabor/shared';
import { useNow, useTableStatuses } from '../../hooks/useTables';
import { useSessionStore } from '../../store/sessionStore';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { PlanCanvas } from './PlanCanvas';
import { MapLegend, OpenTabsList, TableMap } from './TableMap';
import { TableOrderView } from './TableOrderView';

interface TablesWorkspaceProps {
  onSessionChanged: () => void;
  /** Mesa abierta en pantalla (de `?mesa=`), o null para ver el mapa. */
  selectedTableId: number | null;
  onSelectTable: (tableId: number | null) => void;
}

const TOOLBAR_BUTTON =
  'inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-border bg-surface px-3 text-sm font-bold text-text outline-none transition-colors hover:border-forest-line focus-visible:ring-2 focus-visible:ring-ring';

function MapSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando mesas" className="flex flex-col gap-3">
      <PlanCanvas rows={PLAN_MIN_ROWS} label="Cargando plano">
        <Skeleton className="absolute inset-2" />
      </PlanCanvas>
      <Skeleton className="mx-auto h-12 w-full max-w-3xl" />
    </div>
  );
}

/** Modo "Mesas" del POS: mapa del local y, al tocar una mesa, su cuenta con el menú del POS. */
export function TablesWorkspace({ onSessionChanged, selectedTableId, onSelectTable }: TablesWorkspaceProps) {
  const role = useSessionStore((s) => s.user?.role);
  const canEditPlan = role === 'owner' || role === 'admin';
  const tables = useTableStatuses({ poll: selectedTableId === null });
  const now = useNow();

  const selected = selectedTableId === null ? null : tables.data?.find((t) => t.id === selectedTableId);
  if (selectedTableId !== null && selected) {
    return (
      <TableOrderView
        key={selected.id}
        table={selected}
        onSessionChanged={onSessionChanged}
        onBack={() => {
          onSelectTable(null);
          tables.refetch();
        }}
      />
    );
  }
  if (selectedTableId !== null && tables.data && !selected) {
    return (
      <EmptyState
        title="Esa mesa ya no está disponible"
        description="Puede que la hayan desactivado desde el plano."
        action={
          <button type="button" className={TOOLBAR_BUTTON} onClick={() => onSelectTable(null)}>
            Volver al mapa
          </button>
        }
      />
    );
  }

  const select = (table: DiningTableStatus) => onSelectTable(table.id);
  let body;
  if (tables.data === undefined) {
    body = tables.error ? <ErrorState message={tables.error} onRetry={tables.refetch} /> : <MapSkeleton />;
  } else if (tables.data.length === 0) {
    body = (
      <EmptyState
        title="No hay mesas activas"
        description={canEditPlan ? 'Agrega o activa mesas en el plano del local.' : 'Pide al dueño que configure el plano de mesas.'}
        action={
          canEditPlan ? (
            <Link to="/ventas/mesas" className={TOOLBAR_BUTTON}>
              <PencilRuler className="size-4" aria-hidden="true" />
              Editar plano
            </Link>
          ) : undefined
        }
      />
    );
  } else {
    body = (
      <>
        <TableMap tables={tables.data} now={now} onSelect={select} />
        <OpenTabsList tables={tables.data} now={now} onSelect={select} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2">
        <MapLegend />
        <span className="flex-1" />
        <button type="button" onClick={tables.refetch} className={TOOLBAR_BUTTON} aria-label="Actualizar el estado de las mesas">
          <RefreshCw className={tables.loading ? 'size-4 animate-spin motion-reduce:animate-none' : 'size-4'} aria-hidden="true" />
          <span className="max-sm:sr-only">Actualizar</span>
        </button>
        {canEditPlan && (
          <Link to="/ventas/mesas" className={TOOLBAR_BUTTON}>
            <PencilRuler className="size-4" aria-hidden="true" />
            <span className="max-sm:sr-only">Editar plano</span>
          </Link>
        )}
      </div>
      {tables.error && tables.data !== undefined && (
        <p role="alert" className="mx-auto w-full max-w-3xl rounded-xl border-2 border-sky-strong bg-sky-soft px-3 py-2 text-sm text-text">
          No se pudo actualizar el mapa. Se muestra el último estado conocido.
        </p>
      )}
      {body}
    </div>
  );
}
