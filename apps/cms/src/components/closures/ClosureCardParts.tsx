import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import { formatPEN } from '@sabor/shared';
import { describeDifference, type DifferenceKind } from '../../lib/cashCount';
import { percentOf } from '../../lib/closureFormat';
import type { ClosureData } from '../../lib/closureData';
import { cn } from '../../lib/utils';

/*
 * Piezas de la tarjeta de 1080 × 1350 px. Todo el texto usa tintas del sistema
 * (azul de marca / gris), nunca el color de la serie; las barras son de un solo
 * tono (magnitud) con el valor escrito al lado, así que nada depende del color.
 */

export const TOP_PRODUCTS_IN_CARD = 5;

function SectionTitle({ children }: { children: string }) {
  return <h3 className="text-[26px] font-extrabold uppercase leading-none tracking-[0.12em] text-text-muted">{children}</h3>;
}

/** Barra horizontal de 12 px con punta redondeada de 4 px, anclada al inicio de la pista. */
function Bar({ ratio }: { ratio: number }) {
  return (
    <div className="h-[10px] w-full rounded-[4px] bg-surface-2">
      <div className="h-full rounded-[4px] bg-forest" style={{ width: `${Math.max(ratio * 100, 1.5)}%` }} />
    </div>
  );
}

export function PaymentBars({ data, compact }: { data: ClosureData; compact: boolean }) {
  if (data.byMethod.length === 0) return null;
  const max = Math.max(...data.byMethod.map((m) => m.totalCents), 1);
  return (
    <section className="flex flex-col gap-[14px]">
      <SectionTitle>Cobrado por método de pago</SectionTitle>
      <ul className={cn('flex flex-col', compact ? 'gap-[10px]' : 'gap-[16px]')}>
        {data.byMethod.map((m) => (
          <li key={m.paymentMethod} className="flex flex-col gap-[4px]">
            <p className="flex items-baseline justify-between gap-4 text-[32px] leading-[1.2] text-forest">
              <span className="font-bold">
                {m.label} <span className="font-medium text-text-muted">· {m.salesCount}</span>
              </span>
              <span className="font-extrabold tabular-nums">
                {formatPEN(m.totalCents)}{' '}
                <span className="text-[26px] font-bold text-text-muted">{percentOf(m.totalCents, data.totalSalesCents)}%</span>
              </span>
            </p>
            <Bar ratio={m.totalCents / max} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TopProductsList({ data, compact }: { data: ClosureData; compact: boolean }) {
  const top = data.topProducts.slice(0, TOP_PRODUCTS_IN_CARD);
  if (top.length === 0) return null;
  const max = Math.max(...top.map((p) => p.quantity), 1);
  return (
    <section className="flex flex-col gap-[14px]">
      <SectionTitle>Lo más vendido</SectionTitle>
      <ol className={cn('flex flex-col', compact ? 'gap-[8px]' : 'gap-[12px]')}>
        {top.map((p, index) => (
          <li key={`${p.name}-${index}`} className="flex flex-col gap-[4px]">
            <p className="flex items-baseline justify-between gap-4 text-[30px] leading-none text-forest">
              <span className="min-w-0 truncate py-[3px] font-bold leading-[1.2]">
                {index + 1}. {p.name}
              </span>
              <span className="shrink-0 font-extrabold tabular-nums">
                ×{p.quantity} <span className="text-[26px] font-bold text-text-muted">{formatPEN(p.totalCents)}</span>
              </span>
            </p>
            <Bar ratio={p.quantity / max} />
          </li>
        ))}
      </ol>
    </section>
  );
}

const DIFF_STYLE: Record<DifferenceKind, { tone: string; Icon: typeof Check }> = {
  even: { tone: 'text-forest', Icon: Check },
  over: { tone: 'text-success', Icon: ArrowUp },
  short: { tone: 'text-sky-strong', Icon: ArrowDown },
};

function Figure({ label, children, tone }: { label: string; children: ReactNode; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-[8px]">
      <dt className="text-[24px] font-extrabold uppercase leading-none tracking-[0.1em] text-text-muted">{label}</dt>
      <dd className={cn('text-[38px] font-extrabold leading-none tabular-nums text-forest', tone)}>{children}</dd>
    </div>
  );
}

function CashFooter({ data }: { data: ClosureData }) {
  return (
    <p className="flex justify-between gap-4 border-t-[3px] border-border pt-[14px] text-[28px] font-bold text-text-muted">
      <span>Gastos de caja {formatPEN(data.cashExpensesCents)}</span>
      <span>Anuladas {data.voidedCount}</span>
    </p>
  );
}

/** Caja cerrada sin cuadrar (D15): no hay esperado/contado/diferencia, pero sí gastos de caja y anuladas. */
function UnreconciledBlock({ data }: { data: ClosureData }) {
  return (
    <section className="flex flex-col gap-[14px] rounded-[20px] border-[4px] border-forest bg-white px-[32px] py-[20px]">
      <p className="text-[38px] font-extrabold leading-none text-forest">Caja no cuadrada</p>
      <CashFooter data={data} />
    </section>
  );
}

export function CashBlock({ data }: { data: ClosureData }) {
  if (!data.reconciled) return <UnreconciledBlock data={data} />;
  const diff = data.differenceCents === null ? null : describeDifference(data.differenceCents);
  const style = diff ? DIFF_STYLE[diff.kind] : null;
  return (
    <section className="flex flex-col gap-[14px] rounded-[20px] border-[4px] border-forest bg-white px-[32px] py-[20px]">
      <dl className="grid grid-cols-[1fr_1fr_1.8fr] gap-[24px]">
        <Figure label="Esperado">{data.expectedCashCents === null ? '—' : formatPEN(data.expectedCashCents)}</Figure>
        <Figure label="Contado">{data.countedCashCents === null ? 'Sin conteo' : formatPEN(data.countedCashCents)}</Figure>
        <Figure label="Diferencia" tone={style?.tone}>
          {diff && style ? (
            <span className="inline-flex items-center gap-[8px]">
              <style.Icon className="size-[34px] shrink-0" strokeWidth={3.5} aria-hidden="true" />
              {diff.kind === 'even' ? diff.label : `${diff.label} ${formatPEN(diff.absCents)}`}
            </span>
          ) : (
            '—'
          )}
        </Figure>
      </dl>
      <CashFooter data={data} />
    </section>
  );
}
