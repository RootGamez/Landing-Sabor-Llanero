import { useCurrentSession } from '../hooks/usePos';
import { OpenRegisterPanel } from '../components/pos/OpenRegisterPanel';
import { PosWorkspace } from '../components/pos/PosWorkspace';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';

function PosSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando caja">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Punto de venta: sin caja abierta pide abrirla (D3); con caja abierta muestra el mostrador. */
export function PosPage() {
  const { data: session, error, refetch } = useCurrentSession();

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
      <div className="min-h-0 flex-1">
        <PosWorkspace session={session} onSessionChanged={refetch} />
      </div>
    </div>
  );
}
