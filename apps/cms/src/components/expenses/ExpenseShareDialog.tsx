import { useMemo, useRef } from 'react';
import { buildExpenseSummaryText } from '@sabor/shared';
import { useClosureImage } from '../../hooks/useClosureImage';
import { useExpenseSummary } from '../../hooks/useExpenses';
import type { ExpenseFilterValues } from '../../lib/expensesApi';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { REPORT_ITEM_LIMIT, toReportData, type ExpenseReportData } from './expenseReportData';
import { ExpenseShareActions } from './ExpenseShareActions';
import { ExpenseSharePreview } from './ExpenseSharePreview';

interface ExpenseShareDialogProps {
  filters: ExpenseFilterValues;
  /** Filtros que no son de fecha, en texto ("Insumos · Yape"). */
  filterNote: string;
  onClose: () => void;
}

function ShareBody({ data }: { data: ExpenseReportData }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const image = useClosureImage(cardRef, data);
  const text = useMemo(
    () => buildExpenseSummaryText(data.summary, { periodLabel: data.periodLabel, showDates: data.showDates }),
    [data],
  );
  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <ExpenseSharePreview ref={cardRef} data={data} />
      <div className="flex flex-col gap-5">
        <ExpenseShareActions image={image} fileName={data.fileName} text={text} />
        <details className="rounded-xl border-2 border-border bg-card p-4">
          <summary className="min-h-6 cursor-pointer text-sm font-bold text-text">Ver resumen en texto</summary>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-text">{text}</pre>
        </details>
      </div>
    </div>
  );
}

/** Imagen compartible de los egresos del período filtrado: vista previa + compartir / descargar / copiar. */
export function ExpenseShareDialog({ filters, filterNote, onClose }: ExpenseShareDialogProps) {
  const summary = useExpenseSummary(filters, REPORT_ITEM_LIMIT);
  const data = useMemo(
    () => (summary.data ? toReportData(summary.data, filters, filterNote) : null),
    [summary.data, filters, filterNote],
  );
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-4xl overflow-y-auto">
        <DialogTitle>Imagen de egresos</DialogTitle>
        <DialogDescription>Una tarjeta lista para enviar por WhatsApp con los gastos del período filtrado.</DialogDescription>
        {summary.error ? <ErrorState message={summary.error} onRetry={summary.refetch} /> : null}
        {summary.loading && !data ? <Skeleton className="h-72 w-full" /> : null}
        {data ? <ShareBody data={data} /> : null}
      </DialogContent>
    </Dialog>
  );
}
