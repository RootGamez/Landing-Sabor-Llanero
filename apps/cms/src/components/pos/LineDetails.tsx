import { formatPEN, ticketDetailLines, type SaleItem, type SaleItemFlavors } from '@sabor/shared';
import { cn } from '../../lib/utils';

interface LineDetailsProps {
  flavors: SaleItemFlavors | null | undefined;
  note: string | null | undefined;
  quantity: number;
  className?: string;
}

/**
 * Detalle bajo una línea del ticket (sabores por pizza, adicional por
 * categoría y nota), con el MISMO texto que genera `ticketDetailLines` para
 * impresión. Se pinta como nodos de texto de React (escapados: una nota con
 * "<script>" se ve literal). `break-words` evita desbordes con textos largos.
 */
export function LineDetails({ flavors, note, quantity, className }: LineDetailsProps) {
  const lines = ticketDetailLines({ flavors: flavors ?? null, note: note ?? null, quantity });
  if (lines.length === 0) return null;
  return (
    <ul className={cn('flex flex-col gap-0.5 border-l-2 border-border pl-2 text-xs text-text-muted', className)}>
      {lines.map((line, index) => (
        <li key={index} className={cn('break-words', line.startsWith('Nota:') && 'font-semibold text-text')}>
          {line}
        </li>
      ))}
    </ul>
  );
}

/** ¿Alguna línea vendida trae sabores o nota? (las ventas históricas nunca). */
export function hasLineDetails(items: readonly Pick<SaleItem, 'flavors' | 'note'>[]): boolean {
  return items.some((item) => item.flavors != null || item.note != null);
}

/** Líneas de una venta registrada con su detalle (historial del turno). */
export function SaleItemsWithDetails({ items }: { items: readonly SaleItem[] }) {
  return (
    <ul className="flex flex-col gap-1.5 text-sm text-text">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-0.5">
          <span className="flex justify-between gap-2">
            <span className="min-w-0 break-words">
              {item.quantity}× {item.name}
              {item.sizeLabel ? ` (${item.sizeLabel})` : ''}
            </span>
            <span className="shrink-0 tabular-nums">{formatPEN(item.lineTotalCents)}</span>
          </span>
          <LineDetails flavors={item.flavors} note={item.note} quantity={item.quantity} />
        </li>
      ))}
    </ul>
  );
}
