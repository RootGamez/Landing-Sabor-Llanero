import { useSearchParams } from 'react-router-dom';
import { useCurrentSession } from '../hooks/usePos';
import { OpenRegisterPanel } from '../components/pos/OpenRegisterPanel';
import { PosWorkspace } from '../components/pos/PosWorkspace';
import { TablesWorkspace } from '../components/tables/TablesWorkspace';
import { ErrorState } from '../components/ui/ErrorState';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Skeleton } from '../components/ui/Skeleton';

type PosMode = 'mostrador' | 'mesas';

const MODE_PARAM = 'modo';
const TABLE_PARAM = 'mesa';
const MODE_OPTIONS = [
  { value: 'mostrador', label: 'Mostrador' },
  { value: 'mesas', label: 'Mesas' },
] as const;

function PosSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando caja">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}

function parseTableId(raw: string | null): number | null {
  const id = Number(raw);
  return raw !== null && Number.isInteger(id) && id > 0 ? id : null;
}

/** Modo y mesa viven en la URL (`?modo=mesas&mesa=3`): recargar o volver atrás no pierde dónde estabas. */
function usePosMode() {
  const [params, setParams] = useSearchParams();
  const mode: PosMode = params.get(MODE_PARAM) === 'mesas' ? 'mesas' : 'mostrador';
  const tableId = mode === 'mesas' ? parseTableId(params.get(TABLE_PARAM)) : null;
  const setMode = (next: PosMode) => setParams(next === 'mesas' ? { [MODE_PARAM]: 'mesas' } : {});
  const setTable = (id: number | null) =>
    setParams(id === null ? { [MODE_PARAM]: 'mesas' } : { [MODE_PARAM]: 'mesas', [TABLE_PARAM]: String(id) });
  return { mode, tableId, setMode, setTable };
}

/**
 * Punto de venta: sin caja abierta pide abrirla (D3). Con caja abierta, dos
 * modos: "Mostrador" (venta directa, se cobra al momento) y "Mesas" (plano del
 * local: la cuenta de cada mesa se guarda abierta y se cobra al cerrarla).
 */
export function PosPage() {
  const { data: session, error, refetch } = useCurrentSession();
  const { mode, tableId, setMode, setTable } = usePosMode();

  if (session === undefined) {
    if (error) return <ErrorState message={error} onRetry={refetch} />;
    return <PosSkeleton />;
  }
  if (session === null) return <OpenRegisterPanel onChanged={refetch} />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {error && (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-between gap-3 rounded-xl border-2 border-sky-strong bg-sky-soft px-4 py-2 text-sm text-text"
        >
          <span>No se pudo actualizar la caja. Revisa tu conexión.</span>
          <button
            type="button"
            onClick={refetch}
            className="min-h-11 rounded-full border-2 border-forest px-4 font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Reintentar
          </button>
        </div>
      )}
      {tableId === null && (
        <SegmentedControl
          aria-label="Modo de venta"
          value={mode}
          onValueChange={(value) => setMode(value === 'mesas' ? 'mesas' : 'mostrador')}
          options={MODE_OPTIONS}
          className="w-full shrink-0 sm:max-w-sm"
          fullWidth
        />
      )}
      <div className={mode === 'mesas' && tableId === null ? 'min-h-0 flex-1 overflow-y-auto' : 'min-h-0 flex-1'}>
        {mode === 'mesas' ? (
          <TablesWorkspace onSessionChanged={refetch} selectedTableId={tableId} onSelectTable={setTable} />
        ) : (
          <PosWorkspace session={session} onSessionChanged={refetch} />
        )}
      </div>
    </div>
  );
}
