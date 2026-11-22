import { forwardRef, useRef } from 'react';
import { formatPEN } from '@sabor/shared';
import { useElementWidth } from '../../hooks/useElementWidth';
import { CARD_HEIGHT, CARD_WIDTH } from '../../lib/closureShare';
import type { ExpenseReportData } from './expenseReportData';
import { ExpenseReportCard } from './ExpenseReportCard';

/**
 * Vista previa de la tarjeta reducida al ancho disponible. El `ref` apunta a la
 * tarjeta sin escalar (la captura sale a 1080 × 1350 aunque la vista sea chica).
 */
export const ExpenseSharePreview = forwardRef<HTMLDivElement, { data: ExpenseReportData }>(function ExpenseSharePreview(
  { data },
  cardRef,
) {
  const frameRef = useRef<HTMLDivElement>(null);
  const scale = Math.min(useElementWidth(frameRef) / CARD_WIDTH, 1);
  return (
    <div
      ref={frameRef}
      role="img"
      aria-label={`Tarjeta de egresos: ${formatPEN(data.summary.totalCents)} en ${data.summary.count} gastos, ${data.periodLabel}. El detalle está en el resumen en texto.`}
      className="w-full overflow-hidden rounded-xl2 border-2 border-border shadow-sticker"
      style={{ height: CARD_HEIGHT * scale }}
    >
      <div style={{ width: CARD_WIDTH, height: CARD_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }} aria-hidden="true">
        <ExpenseReportCard ref={cardRef} data={data} />
      </div>
    </div>
  );
});
