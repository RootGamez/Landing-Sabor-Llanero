import { forwardRef, type ReactNode } from 'react';
import { BRAND, formatPEN } from '@sabor/shared';
import { originLabel, type ReceiptData, type ReceiptLine, type ReceiptOrigin } from '../../lib/receiptData';
import { cn } from '../../lib/utils';
import { BrandLogo } from '../closures/BrandLogo';

/** Ancho fijo del comprobante en px (equivale a un ticket de 80 mm); la altura depende de las líneas. */
export const RECEIPT_WIDTH = 576;
/** Fondo del papel: se usa también como fondo del PNG para que no quede transparente. */
export const RECEIPT_BACKGROUND = '#ffffff';

function Rule() {
  return <div className="h-0 border-t-[3px] border-dashed border-onyx/35" aria-hidden="true" />;
}

function Row({ label, value, strong, className }: { label: string; value: ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-[16px]', strong && 'font-extrabold', className)}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function OriginBlock({ origin }: { origin: ReceiptOrigin }) {
  return (
    <section aria-label="Origen de la venta" className="flex flex-col gap-[8px]">
      <p className="text-[36px] font-black leading-none">{originLabel(origin)}</p>
      {origin.kind === 'table' && (
        <div className="flex flex-col gap-[4px] text-[24px] text-onyx">
          <Row label="Abierta" value={origin.openedAtLabel} />
          <Row label="Cobrada" value={origin.paidAtLabel} />
          {origin.stayLabel && <Row label="Permanencia" value={origin.stayLabel} />}
        </div>
      )}
    </section>
  );
}

function LineItem({ line }: { line: ReceiptLine }) {
  return (
    <li className="flex flex-col gap-[4px]">
      <div className="flex items-start justify-between gap-[16px] text-[26px] font-bold leading-tight">
        <span className="min-w-0 break-words">
          {line.quantity}× {line.title}
        </span>
        <span className="shrink-0 tabular-nums">{formatPEN(line.lineTotalCents)}</span>
      </div>
      {line.details.length > 0 && (
        <ul className="flex flex-col gap-[2px] border-l-[4px] border-onyx/25 pl-[12px] text-[22px] leading-snug text-text-muted">
          {line.details.map((detail, index) => (
            <li key={index} className={cn('break-words', detail.startsWith('Nota:') && 'font-bold text-onyx')}>
              {detail}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Totals({ data }: { data: ReceiptData }) {
  return (
    <section aria-label="Totales" className="flex flex-col gap-[6px] text-[26px]">
      <Row label="Subtotal" value={formatPEN(data.subtotalCents)} />
      {data.discountCents > 0 && <Row label="Descuento" value={`− ${formatPEN(data.discountCents)}`} />}
      <div className="mt-[6px] flex items-baseline justify-between gap-[16px]">
        <span className="text-[32px] font-black uppercase tracking-[0.06em]">Total</span>
        <span className={cn('text-[68px] font-black leading-none tabular-nums', data.voided && 'line-through decoration-[5px]')}>
          {formatPEN(data.totalCents)}
        </span>
      </div>
    </section>
  );
}

function Payment({ data }: { data: ReceiptData }) {
  return (
    <section aria-label="Pago" className="flex flex-col gap-[6px] text-[26px]">
      <Row label="Pago" value={data.methodLabel} strong />
      {data.cashReceivedCents !== null && <Row label="Efectivo recibido" value={formatPEN(data.cashReceivedCents)} />}
      {data.changeCents !== null && <Row label="Vuelto" value={formatPEN(data.changeCents)} strong />}
    </section>
  );
}

/**
 * Sello de anulación: texto + borde (no depende solo del color). No lleva el
 * motivo: el comprobante se comparte con el cliente y el motivo es una nota
 * interna del cajero.
 */
function VoidStamp() {
  return (
    <div className="flex flex-col items-center">
      <p className="-rotate-3 rounded-[10px] border-[6px] border-sky-strong px-[28px] py-[6px] text-[60px] font-black uppercase leading-none tracking-[0.1em] text-sky-strong">
        Anulada
      </p>
    </div>
  );
}

interface ReceiptCardProps {
  data: ReceiptData;
  className?: string;
}

/**
 * Comprobante de venta de 576 px de ancho (tipo ticket de 80 mm) y altura según
 * las líneas. Tamaño en px, no responsive: `html-to-image` lo captura tal cual
 * y la vista previa / impresión solo lo reducen. Comprobante interno: no es
 * boleta ni factura.
 */
export const ReceiptCard = forwardRef<HTMLDivElement, ReceiptCardProps>(function ReceiptCard({ data, className }, ref) {
  return (
    <div
      ref={ref}
      style={{ width: RECEIPT_WIDTH, backgroundColor: RECEIPT_BACKGROUND }}
      className={cn('receipt-card flex flex-col gap-[22px] px-[36px] pb-[36px] pt-[32px] font-sans text-[24px] text-onyx', className)}
    >
      <header className="flex flex-col items-center gap-[10px] text-center">
        <BrandLogo className="h-[84px] w-auto" />
        <p className="text-[22px] font-semibold text-text-muted">{BRAND.fullName} · {BRAND.address.locality}</p>
      </header>
      <Rule />
      <section aria-label="Venta" className="flex flex-col items-center gap-[6px] text-center">
        <p className="text-[24px] font-extrabold uppercase tracking-[0.14em]">Comprobante de venta</p>
        <p className="text-[52px] font-black leading-none">Venta #{data.number}</p>
        <p className="text-[24px] font-medium">{data.dateLabel}</p>
        <p className="text-[28px] font-bold tabular-nums">{data.timeLabel}</p>
      </section>
      {data.voided && <VoidStamp />}
      <Rule />
      <OriginBlock origin={data.origin} />
      <Rule />
      <ul className="flex flex-col gap-[16px]">
        {data.lines.map((line) => (
          <LineItem key={line.id} line={line} />
        ))}
      </ul>
      <Rule />
      <Totals data={data} />
      <Rule />
      <Payment data={data} />
      <Rule />
      <footer className="flex flex-col items-center gap-[6px] text-center">
        <p className="text-[30px] font-extrabold">Gracias por tu compra</p>
        <p className="text-[24px] font-bold text-onyx">Documento no válido como boleta ni factura</p>
      </footer>
    </div>
  );
});
