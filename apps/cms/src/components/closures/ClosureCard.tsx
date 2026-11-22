import { forwardRef } from 'react';
import { formatPEN } from '@sabor/shared';
import { averageTicketCents, formatLimaLongDate, formatShiftRange } from '../../lib/closureFormat';
import type { ClosureData } from '../../lib/closureData';
import { CARD_HEIGHT, CARD_WIDTH } from '../../lib/closureShare';
import { BrandLogo } from './BrandLogo';
import { CashBlock, PaymentBars, TopProductsList } from './ClosureCardParts';

/** Con más de 3 métodos de pago las filas se compactan para que todo entre en 1350 px. */
const COMPACT_METHODS_THRESHOLD = 3;

interface ClosureCardProps {
  data: ClosureData;
}

/**
 * Tarjeta "ticket Z" de 1080 × 1350 px para compartir por WhatsApp. Tamaño fijo
 * en píxeles (no responsive): `html-to-image` la captura tal cual y la vista
 * previa solo la reduce con `transform`. Texto >= 24 px para que se lea en el celular.
 */
export const ClosureCard = forwardRef<HTMLDivElement, ClosureCardProps>(function ClosureCard({ data }, ref) {
  const compact = data.byMethod.length > COMPACT_METHODS_THRESHOLD;
  const reference = data.closedAt ?? data.openedAt;
  return (
    <div
      ref={ref}
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
      className="relative flex flex-col overflow-hidden bg-bone font-sans text-forest"
    >
      <header className="flex items-center justify-between gap-[24px] bg-forest px-[56px] py-[36px]">
        <BrandLogo className="h-[112px] w-auto shrink-0" />
        <div className="flex flex-col items-end gap-[8px] text-right">
          <p className="text-[44px] font-black uppercase leading-none tracking-[0.06em] text-lime">Cierre de caja</p>
          <p className="text-[30px] font-bold leading-tight text-bone">{formatLimaLongDate(reference)}</p>
          <p className="text-[28px] font-medium leading-none text-bone/85">
            Turno {formatShiftRange(data.openedAt, data.closedAt)}
          </p>
        </div>
      </header>
      <div className="h-[12px] shrink-0 bg-lime" />

      <div className="flex min-h-0 flex-1 flex-col justify-between px-[56px] pb-[28px] pt-[32px]">
        <section className="flex flex-col gap-[14px]">
          <p className="text-[26px] font-extrabold uppercase leading-none tracking-[0.12em] text-text-muted">Total vendido</p>
          <p className="text-[132px] font-black leading-[0.9] tabular-nums tracking-tight">{formatPEN(data.totalSalesCents)}</p>
          <p className="flex gap-[40px] text-[34px] font-bold leading-none">
            <span>{data.salesCount} ventas</span>
            <span>Ticket promedio {formatPEN(averageTicketCents(data))}</span>
          </p>
        </section>
        <PaymentBars data={data} compact={compact} />
        <TopProductsList data={data} compact={compact} />
        <CashBlock data={data} />
        <p className="text-center text-[24px] font-semibold leading-none text-text-muted">Sabor Llanero · Pizzería artesanal en Pisco</p>
      </div>
    </div>
  );
});
