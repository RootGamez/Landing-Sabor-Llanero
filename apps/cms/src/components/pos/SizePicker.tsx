import { formatPEN } from '@sabor/shared';
import type { PosOption, PosProduct } from '../../lib/posCatalog';
import { PosModal } from './PosModal';

interface SizePickerProps {
  product: PosProduct | null;
  onPick: (product: PosProduct, option: PosOption) => void;
  onClose: () => void;
}

/** Selector de tamaño: un botón grande por tamaño con su precio ya resuelto (override o herencia). */
export function SizePicker({ product, onPick, onClose }: SizePickerProps) {
  return (
    <PosModal
      open={product !== null}
      onOpenChange={(open) => !open && onClose()}
      title={product?.name ?? 'Elige el tamaño'}
      description="Elige el tamaño para agregarlo al ticket."
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
              <span className="text-lg font-bold">{option.label}</span>
              <span className="text-lg font-bold tabular-nums">{formatPEN(option.priceCents)}</span>
            </button>
          </li>
        ))}
      </ul>
    </PosModal>
  );
}
