import { forwardRef } from 'react';
import { formatPEN } from '@sabor/shared';
import { CARD_HEIGHT, CARD_WIDTH } from '../../lib/closureShare';
import { BrandLogo } from '../closures/BrandLogo';
import type { ExpenseReportData } from './expenseReportData';
import { CategoryBars, ExpenseRows } from './ExpenseReportParts';

interface ExpenseReportCardProps {
  data: ExpenseReportData;
}

/**
 * Tarjeta de egresos de 1080 × 1350 px (misma familia visual que el cierre de
 * caja). Tamaño fijo en píxeles: `html-to-image` la captura tal cual y la vista
 * previa solo la reduce con `transform`.
 */
export const ExpenseReportCard = forwardRef<HTMLDivElement, ExpenseReportCardProps>(function ExpenseReportCard({ data }, ref) {
  const { summary } = data;
  return (
    <div
      ref={ref}
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
      className="relative flex flex-col overflow-hidden bg-bone font-sans text-forest"
    >
      <header className="flex items-center justify-between gap-[24px] bg-forest px-[56px] py-[28px]">
        <BrandLogo className="h-[96px] w-auto shrink-0" />
        <div className="flex min-w-0 flex-col items-end gap-[8px] text-right">
          <p className="text-[44px] font-black uppercase leading-none tracking-[0.06em] text-lime">Egresos</p>
          <p className="text-[30px] font-bold leading-tight text-bone">{data.periodLabel}</p>
          {data.filterNote && <p className="max-w-[640px] truncate text-[26px] font-medium leading-none text-bone/85">{data.filterNote}</p>}
        </div>
      </header>
      <div className="h-[12px] shrink-0 bg-lime" />

      <div className="flex min-h-0 flex-1 flex-col justify-between px-[56px] pb-[22px] pt-[26px]">
        <section className="flex flex-col gap-[12px]">
          <p className="text-[26px] font-extrabold uppercase leading-none tracking-[0.12em] text-text-muted">Total de egresos</p>
          <p className="text-[132px] font-black leading-[0.9] tabular-nums tracking-tight">{formatPEN(summary.totalCents)}</p>
          <p className="text-[34px] font-bold leading-none">
            {summary.count} {summary.count === 1 ? 'gasto' : 'gastos'}
          </p>
        </section>
        {summary.count === 0 ? (
          <p className="text-[34px] font-bold text-text-muted">No hay gastos en este período.</p>
        ) : (
          <>
            <CategoryBars summary={summary} />
            <ExpenseRows summary={summary} showDates={data.showDates} />
          </>
        )}
        <p className="text-center text-[24px] font-semibold leading-none text-text-muted">Sabor Llanero · Pizzería artesanal en Pisco</p>
      </div>
    </div>
  );
});
