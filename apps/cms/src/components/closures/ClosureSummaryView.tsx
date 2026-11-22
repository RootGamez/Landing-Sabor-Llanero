import { useMemo, useRef } from 'react';
import { ArrowLeft, CircleCheck } from 'lucide-react';
import type { CashSessionDetail } from '@sabor/shared';
import { useClosureImage } from '../../hooks/useClosureImage';
import { buildClosureText, closureFileName, toClosureData } from '../../lib/closureData';
import { formatLimaLongDate } from '../../lib/closureFormat';
import { Badge } from '../ui/badge';
import { Button } from '../ui/Button';
import { ClosureActions } from './ClosureActions';
import { ClosurePreview } from './ClosurePreview';

interface ClosureSummaryViewProps {
  detail: CashSessionDetail;
  /** `true` cuando se acaba de cerrar (muestra la confirmación); `false` al regenerar desde el historial. */
  justClosed?: boolean;
  onBack?: () => void;
  backLabel?: string;
}

/** Resumen del día: tarjeta-imagen compartible + acciones + el mismo contenido como texto. */
export function ClosureSummaryView({ detail, justClosed = false, onBack, backLabel = 'Volver' }: ClosureSummaryViewProps) {
  const data = useMemo(() => toClosureData(detail), [detail]);
  const text = useMemo(() => buildClosureText(data), [data]);
  const cardRef = useRef<HTMLDivElement>(null);
  const image = useClosureImage(cardRef, data);
  const day = formatLimaLongDate(data.closedAt ?? data.openedAt);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            {backLabel}
          </Button>
        )}
        {data.source !== 'pos' && <Badge variant="muted">Importado</Badge>}
      </div>
      <header className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-text">
          {justClosed && <CircleCheck className="size-7 text-success" aria-hidden="true" />}
          {justClosed ? 'Caja cerrada' : 'Resumen del día'}
        </h2>
        <p className="text-sm text-text-muted">{day}</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <ClosurePreview ref={cardRef} data={data} />
        <div className="flex flex-col gap-5">
          <ClosureActions image={image} fileName={closureFileName(data)} text={text} />
          <details className="rounded-xl border-2 border-border bg-card p-4">
            <summary className="min-h-6 cursor-pointer text-sm font-bold text-text">Ver resumen en texto</summary>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-text">{text}</pre>
          </details>
        </div>
      </div>
    </div>
  );
}
