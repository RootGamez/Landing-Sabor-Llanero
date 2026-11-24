import type { ResolvedPrice } from '@sabor/shared';
import { formatPrice } from '../../lib/format';

interface PortionChoiceProps {
  itemName: string;
  portions: ResolvedPrice[];
  onPick: (portion: ResolvedPrice) => void;
  onCancel: () => void;
}

/** Elección de presentación (Media docena, 1 docena…) al agregar un ítem a un pedido web. */
export function PortionChoice({ itemName, portions, onPick, onCancel }: PortionChoiceProps) {
  return (
    <div role="group" aria-label={`Presentación de ${itemName}`} className="flex flex-col gap-2 px-3 py-2">
      <p className="text-sm font-semibold text-text">Elige la presentación de {itemName}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {portions.map((portion) => (
          <button
            key={portion.sizeId}
            type="button"
            onClick={() => onPick(portion)}
            aria-label={`Agregar ${itemName}, ${portion.labelEs ?? portion.sizeKey}, ${formatPrice(portion.price)}`}
            className="min-h-11 rounded-full border-2 border-border px-3 py-1 text-sm font-bold text-text outline-none transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            {portion.labelEs ?? portion.sizeKey} · {formatPrice(portion.price)}
          </button>
        ))}
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-full px-3 text-sm font-medium text-text-muted outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
