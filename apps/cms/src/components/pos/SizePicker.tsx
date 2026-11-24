import { formatPEN } from '@sabor/shared';
import type { PosOption, PosProduct } from '../../lib/posCatalog';
import { PosModal } from './PosModal';

interface SizePickerProps {
  product: PosProduct | null;
  onPick: (product: PosProduct, option: PosOption) => void;
  onClose: () => void;
}

/** Las opciones con `units` son presentaciones (Media docena…); sin ellas son tamaños de pizza. */
function isPortionProduct(product: PosProduct | null): boolean {
  return product?.options.some((option) => option.units !== undefined) ?? false;
}

/** "6 unidades" (singular si fuera 1). */
function unitsLabel(units: number): string {
  return `${units} ${units === 1 ? 'unidad' : 'unidades'}`;
}

/**
 * Selector de tamaño o presentación: un botón grande por opción con su precio ya resuelto
 * (override o herencia). Las presentaciones muestran además sus unidades.
 */
export function SizePicker({ product, onPick, onClose }: SizePickerProps) {
  const prompt = isPortionProduct(product) ? 'Elige la presentación' : 'Elige el tamaño';
  return (
    <PosModal
      open={product !== null}
      onOpenChange={(open) => !open && onClose()}
      title={product?.name ?? prompt}
      description={`${prompt} para agregarlo al ticket.`}
    >
      <ul className="flex flex-col gap-2.5">
        {product?.options.map((option, index) => (
          <li key={option.sizeId ?? 'unico'}>
            <button
              type="button"
              onClick={() => onPick(product, option)}
              data-autofocus={index === 0 ? '' : undefined}
              className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border-2 border-forest bg-lime-soft px-4 text-left text-text shadow-sticker outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:transition-none"
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-lg font-bold">{option.label}</span>
                {option.units !== undefined && (
                  <span className="text-sm font-medium text-text-muted">{unitsLabel(option.units)}</span>
                )}
              </span>
              <span className="text-lg font-bold tabular-nums">{formatPEN(option.priceCents)}</span>
            </button>
          </li>
        ))}
      </ul>
    </PosModal>
  );
}
