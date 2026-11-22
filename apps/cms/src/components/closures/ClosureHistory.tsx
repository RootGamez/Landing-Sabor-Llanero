import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { formatPEN, isReconciledSnapshot, type CashSession } from '@sabor/shared';
import { describeDifference } from '../../lib/cashCount';
import { HISTORY_PAGE_SIZE } from '../../lib/closuresApi';
import { formatLimaLongDate, formatShiftRange } from '../../lib/closureFormat';
import { useCashSessionHistory } from '../../hooks/useClosures';
import { Badge } from '../ui/badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';

function differenceText(session: CashSession): string {
  const snapshot = session.closeSnapshot;
  if (!snapshot || !isReconciledSnapshot(snapshot)) return '—';
  const diff = describeDifference(snapshot.differenceCents);
  return diff.kind === 'even' ? diff.label : `${diff.label} ${formatPEN(diff.absCents)}`;
}

function HistoryRow({ session, onSelect }: { session: CashSession; onSelect: (id: number) => void }) {
  const snapshot = session.closeSnapshot;
  const day = formatLimaLongDate(session.closedAt ?? session.openedAt);
  return (
    <tr className="border-t border-border align-middle">
      <td className="px-3 py-3">
        <p className="font-bold text-text">{day}</p>
        <p className="text-xs text-text-muted">{formatShiftRange(session.openedAt, session.closedAt)}</p>
      </td>
      <td className="px-3 py-3 font-bold tabular-nums text-text">{snapshot ? formatPEN(snapshot.totalSalesCents) : '—'}</td>
      <td className="hidden px-3 py-3 tabular-nums text-text sm:table-cell">{snapshot ? snapshot.salesCount : '—'}</td>
      <td className="hidden px-3 py-3 text-text md:table-cell">{differenceText(session)}</td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {session.closedAt === null && <Badge variant="accent">Abierta</Badge>}
          {session.source !== 'pos' && <Badge variant="muted">Importado</Badge>}
          {snapshot && !isReconciledSnapshot(snapshot) && <Badge variant="muted">Sin cuadrar</Badge>}
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        {session.closedAt !== null && (
          <Button variant="outline" size="sm" onClick={() => onSelect(session.id)}>
            <ImageIcon aria-hidden="true" />
            Ver resumen<span className="sr-only"> del {day}</span>
          </Button>
        )}
      </td>
    </tr>
  );
}

interface ClosureHistoryProps {
  page: number;
  onPageChange: (page: number) => void;
  onSelect: (id: number) => void;
}

/** Historial de cierres (owner/admin): desde acá se abre el detalle y se regenera la imagen. */
export function ClosureHistory({ page, onPageChange, onSelect }: ClosureHistoryProps) {
  const { data, loading, error, refetch } = useCashSessionHistory(page);

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return <Skeleton className="h-48 w-full" />;
  if (data.items.length === 0) {
    return <EmptyState title="Aún no hay cierres" description="Cuando cierres la primera caja aparecerá acá." />;
  }

  const totalPages = Math.max(1, Math.ceil(data.total / HISTORY_PAGE_SIZE));
  return (
    <div className="flex flex-col gap-3" aria-busy={loading}>
      <div className="overflow-x-auto rounded-xl2 border-2 border-border bg-card">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <caption className="sr-only">Historial de cierres de caja</caption>
          <thead className="bg-muted text-xs font-bold uppercase tracking-wide text-text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">Día y turno</th>
              <th scope="col" className="px-3 py-2">Vendido</th>
              <th scope="col" className="hidden px-3 py-2 sm:table-cell">Ventas</th>
              <th scope="col" className="hidden px-3 py-2 md:table-cell">Diferencia</th>
              <th scope="col" className="px-3 py-2">Estado</th>
              <th scope="col" className="px-3 py-2"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((session) => (
              <HistoryRow key={session.id} session={session} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      </div>
      <nav aria-label="Paginación del historial" className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft aria-hidden="true" />
          Anterior
        </Button>
        <span className="text-sm text-text-muted">
          Página {page} de {totalPages}
        </span>
        <Button variant="ghost" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Siguiente
          <ChevronRight aria-hidden="true" />
        </Button>
      </nav>
    </div>
  );
}
