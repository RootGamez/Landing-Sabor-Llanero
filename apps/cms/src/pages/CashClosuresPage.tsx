import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import type { CashSessionDetail } from '@sabor/shared';
import { ClosureHistory } from '../components/closures/ClosureHistory';
import { ClosureSummaryView } from '../components/closures/ClosureSummaryView';
import { CloseRegisterFlow } from '../components/closures/CloseRegisterFlow';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { useCashSessionDetail } from '../hooks/useClosures';
import { useCurrentSession } from '../hooks/usePos';
import { useSessionStore } from '../store/sessionStore';

const SESSION_PARAM = 'id';

function parseSessionId(raw: string | null): number | null {
  const id = Number(raw);
  return raw !== null && Number.isInteger(id) && id > 0 ? id : null;
}

function PageHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="font-display text-3xl font-bold text-text">{title}</h1>
      <p className="text-sm text-text-muted">{subtitle}</p>
    </header>
  );
}

/** Resumen de una sesión cerrada (la recién cerrada o una del historial), cargado por id. */
function SessionSummary({ id, justClosed, onBack }: { id: number; justClosed: boolean; onBack: () => void }) {
  const { data, error, refetch } = useCashSessionDetail(id);
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2">
        <ErrorState message={error} onRetry={refetch} />
        <Button variant="outline" onClick={onBack}>
          Volver a cierres
        </Button>
      </div>
    );
  }
  if (!data) return <Skeleton className="h-96 w-full" />;
  return <ClosureSummaryView detail={data} justClosed={justClosed} onBack={onBack} backLabel="Volver a cierres" />;
}

function NoOpenRegister({ canSeeHistory }: { canSeeHistory: boolean }) {
  return (
    <EmptyState
      title="No hay una caja abierta"
      description={
        canSeeHistory
          ? 'Cuando abras una caja desde el punto de venta, podrás cerrarla desde acá.'
          : 'Abre la caja en el punto de venta para empezar a vender y cerrarla al terminar el turno.'
      }
      action={
        <Button asChild variant="outline">
          <Link to="/ventas/pos">
            <ShoppingCart aria-hidden="true" />
            Ir al punto de venta
          </Link>
        </Button>
      }
    />
  );
}

/**
 * Cierres de caja. Con caja abierta: arqueo y cierre. Al cerrar: resumen del día
 * con la imagen para compartir (`?id=` permite recargar sin perderlo). Owner/admin
 * además ven el historial y pueden regenerar la imagen de cualquier cierre.
 * El cajero (D9) solo cierra su caja y ve el resumen recién cerrado.
 */
export function CashClosuresPage() {
  const isCashier = useSessionStore((s) => s.user?.role) === 'cashier';
  const [params, setParams] = useSearchParams();
  const selectedId = parseSessionId(params.get(SESSION_PARAM));
  const [justClosedId, setJustClosedId] = useState<number | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const current = useCurrentSession();

  const openSummary = (id: number) => setParams({ [SESSION_PARAM]: String(id) });
  const closeSummary = () => {
    setParams({}, { replace: true });
    setJustClosedId(null);
  };
  const handleClosed = (detail: CashSessionDetail) => {
    setJustClosedId(detail.id);
    current.refetch();
    openSummary(detail.id);
  };

  if (selectedId !== null) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <SessionSummary id={selectedId} justClosed={selectedId === justClosedId} onBack={closeSummary} />
      </div>
    );
  }

  const session = current.data;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeading
        title="Cierres de caja"
        subtitle="Cuenta el efectivo, compara con lo esperado y comparte el resumen del día en imagen."
      />
      {session === undefined && (current.error ? <ErrorState message={current.error} onRetry={current.refetch} /> : <Skeleton className="h-72 w-full" />)}
      {session === null && <NoOpenRegister canSeeHistory={!isCashier} />}
      {session && <CloseRegisterFlow key={session.id} session={session} onClosed={handleClosed} onRefresh={current.refetch} />}
      {!isCashier && (
        <section aria-labelledby="closure-history-title" className="flex flex-col gap-3">
          <h2 id="closure-history-title" className="font-display text-xl font-bold text-text">
            Historial de cierres
          </h2>
          <ClosureHistory page={historyPage} onPageChange={setHistoryPage} onSelect={openSummary} />
        </section>
      )}
    </div>
  );
}
