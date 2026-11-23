import { useState } from 'react';
import { MessageSquareText, Pizza } from 'lucide-react';
import type { CartLine } from '../../lib/posCart';
import { useCartApi } from '../../store/posCartContext';
import { usePosCatalogStore } from '../../store/posCatalogStore';
import { FlavorPicker, type FlavorRequest } from './FlavorPicker';
import { LineDetails } from './LineDetails';
import { LineNoteDialog } from './LineNoteDialog';

const EXTRA_BUTTON =
  'inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-border bg-surface px-3 text-sm font-bold text-text outline-none transition-colors hover:border-forest-line focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40';

interface TicketLineExtrasProps {
  line: CartLine;
  /** Línea ya guardada que este usuario no puede modificar (cuenta de mesa). */
  locked?: boolean;
}

/**
 * Detalle + acciones de una línea del ticket: "Agregar sabores" (pizzas y
 * promos con pizzas) y "Nota". Editar cambia la identidad de la línea; si queda
 * igual a otra, el store las fusiona.
 */
export function TicketLineExtras({ line, locked = false }: TicketLineExtrasProps) {
  const cart = useCartApi();
  const product = usePosCatalogStore((s) => s.catalog?.products.find((p) => p.id === line.itemId));
  const catalogMissing = usePosCatalogStore((s) => s.catalog === null);
  const [flavorRequest, setFlavorRequest] = useState<FlavorRequest | null>(null);
  const [editingNote, setEditingNote] = useState(false);

  const hasFlavors = (line.flavors?.length ?? 0) > 0;
  // Sin catálogo se ofrece igual (el selector muestra "reintentar"); con catálogo, solo donde aplica.
  const supportsFlavors = catalogMissing ? hasFlavors : Boolean(product?.isPizza || product?.promo);
  const needsFlavors = Boolean(product?.promo) && !hasFlavors;
  const label = `${line.name}${line.sizeLabel ? ` ${line.sizeLabel}` : ''}`;

  function openFlavors() {
    if (product) setFlavorRequest({ product, sizeId: line.sizeId, initial: line.flavors ?? null });
    else setFlavorRequest({ product: placeholderProduct(line), sizeId: line.sizeId, initial: line.flavors ?? null });
  }

  return (
    <>
      <LineDetails flavors={line.flavorInfo} note={line.note} quantity={line.quantity} />
      {needsFlavors && <p className="text-xs font-semibold text-destructive">Falta elegir los sabores de la promo.</p>}
      {!locked && (
        <div className="flex flex-wrap gap-2">
          {supportsFlavors && (
            <button type="button" className={EXTRA_BUTTON} onClick={openFlavors} aria-label={`${hasFlavors ? 'Cambiar sabores' : 'Agregar sabores'} de ${label}`}>
              <Pizza className="size-4" aria-hidden="true" />
              {hasFlavors ? 'Sabores' : 'Agregar sabores'}
            </button>
          )}
          <button type="button" className={EXTRA_BUTTON} onClick={() => setEditingNote(true)} aria-label={`${line.note ? 'Editar nota' : 'Agregar nota'} de ${label}`}>
            <MessageSquareText className="size-4" aria-hidden="true" />
            Nota
          </button>
        </div>
      )}
      <FlavorPicker
        request={flavorRequest}
        confirmLabel="Listo"
        onClose={() => setFlavorRequest(null)}
        onConfirm={(choice) => {
          cart.getState().updateDetails(line.key, choice);
          setFlavorRequest(null);
        }}
      />
      <LineNoteDialog
        target={editingNote ? { title: label, note: line.note ?? null } : null}
        onClose={() => setEditingNote(false)}
        onSave={(note) => {
          cart.getState().updateDetails(line.key, { note });
          setEditingNote(false);
        }}
      />
    </>
  );
}

/** Mientras el catálogo no cargó: el selector necesita un producto para mostrar el estado "reintentar". */
function placeholderProduct(line: CartLine) {
  return {
    id: line.itemId,
    name: line.name,
    categoryId: 0,
    categoryName: '',
    colorIndex: 0,
    options: [],
    searchText: '',
  };
}
