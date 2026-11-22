import { formatPEN, type ExpenseSummary } from '@sabor/shared';
import { cn } from '../../lib/utils';
import { categoryRows } from './expenseReportData';

/*
 * Piezas de la tarjeta de egresos (1080 × 1350 px). Mismo criterio que el cierre:
 * una sola tinta para las barras (magnitud, no identidad), el valor escrito junto
 * a cada barra y el texto en tintas del sistema, nunca en el color de la serie.
 */

const SHORT_MONTH_DAY = /^\d{4}-(\d{2})-(\d{2})$/;

function SectionTitle({ children }: { children: string }) {
  return <h3 className="text-[26px] font-extrabold uppercase leading-none tracking-[0.12em] text-text-muted">{children}</h3>;
}

/** Barra horizontal con punta redondeada de 4 px, anclada al inicio de la pista. */
function Bar({ ratio }: { ratio: number }) {
  return (
    <div className="h-[10px] w-full rounded-[4px] bg-surface-2">
      <div className="h-full rounded-[4px] bg-forest" style={{ width: `${Math.max(ratio * 100, 1.5)}%` }} />
    </div>
  );
}

export function CategoryBars({ summary }: { summary: ExpenseSummary }) {
  const rows = categoryRows(summary.byCategory);
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.totalCents), 1);
  return (
    <section className="flex flex-col gap-[14px]">
      <SectionTitle>Por categoría</SectionTitle>
      <ul className="flex flex-col gap-[10px]">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-[4px]">
            <p className="flex items-baseline justify-between gap-4 text-[30px] leading-[1.2] text-forest">
              <span className="min-w-0 truncate font-bold">
                {row.name} <span className="font-medium text-text-muted">· {row.count}</span>
              </span>
              <span className="shrink-0 font-extrabold tabular-nums">
                {formatPEN(row.totalCents)}{' '}
                <span className="text-[26px] font-bold text-text-muted">
                  {summary.totalCents > 0 ? Math.round((row.totalCents / summary.totalCents) * 100) : 0}%
                </span>
              </span>
            </p>
            <Bar ratio={row.totalCents / max} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function shortDate(day: string): string {
  const match = SHORT_MONTH_DAY.exec(day);
  return match ? `${match[2]}/${match[1]}` : day;
}

export function ExpenseRows({ summary, showDates }: { summary: ExpenseSummary; showDates: boolean }) {
  if (summary.items.length === 0) return null;
  return (
    <section className="flex flex-col gap-[10px]">
      <SectionTitle>Gastos</SectionTitle>
      <ul className="flex flex-col gap-[4px]">
        {summary.items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-4 text-[26px] leading-[1.25] text-forest">
            <span className="flex min-w-0 items-baseline gap-[10px]">
              {showDates && <span className="shrink-0 font-semibold tabular-nums text-text-muted">{shortDate(item.date)}</span>}
              <span className={cn('truncate font-bold', !item.description && 'text-text-muted')}>
                {item.description || item.categoryName}
              </span>
              {item.description && <span className="shrink-0 font-medium text-text-muted">· {item.categoryName}</span>}
            </span>
            <span className="shrink-0 font-extrabold tabular-nums">{formatPEN(item.amountCents)}</span>
          </li>
        ))}
      </ul>
      {summary.moreCount > 0 && <p className="text-[26px] font-bold leading-none text-text-muted">+{summary.moreCount} más</p>}
    </section>
  );
}
