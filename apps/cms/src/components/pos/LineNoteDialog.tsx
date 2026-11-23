import { useId, useState, type FormEvent } from 'react';
import { LINE_NOTE_MAX, normalizeLineNote } from '@sabor/shared';
import { Button } from '../ui/Button';
import { PosModal } from './PosModal';

/** Notas frecuentes: un toque las agrega al texto (se pueden combinar y editar). */
const QUICK_NOTES = ['Sin cebolla', 'Bien cocida', 'Para llevar', 'Cortar en cuadritos'] as const;

interface LineNoteDialogProps {
  /** Línea a la que se le pone la nota (null = cerrado). */
  target: { title: string; note: string | null } | null;
  onSave: (note: string | null) => void;
  onClose: () => void;
}

/** Nota libre por línea del ticket ("sin cebolla"). Se sanea igual que en el servidor. */
export function LineNoteDialog({ target, onSave, onClose }: LineNoteDialogProps) {
  return (
    <PosModal
      open={target !== null}
      onOpenChange={(open) => !open && onClose()}
      placement="sheet"
      title={target ? `Nota · ${target.title}` : 'Nota'}
      description="Se imprime bajo el producto en el ticket."
    >
      {target && <NoteForm key={target.title} initial={target.note ?? ''} onSave={onSave} />}
    </PosModal>
  );
}

function NoteForm({ initial, onSave }: { initial: string; onSave: (note: string | null) => void }) {
  const fieldId = useId();
  const [text, setText] = useState(initial);

  function append(quick: string) {
    const joined = text.trim() ? `${text.trim()}, ${quick.toLowerCase()}` : quick;
    setText(joined.slice(0, LINE_NOTE_MAX));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSave(normalizeLineNote(text));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor={fieldId} className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">
        Nota del producto
      </label>
      <textarea
        id={fieldId}
        value={text}
        maxLength={LINE_NOTE_MAX}
        rows={3}
        onChange={(event) => setText(event.target.value)}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- el cajero abrió "Nota": escribirla es el siguiente paso.
        autoFocus
        aria-describedby={`${fieldId}-count`}
        className="w-full rounded-xl border-2 border-border bg-surface px-3 py-2 text-base text-text outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
      <p id={`${fieldId}-count`} className="text-right text-xs tabular-nums text-text-muted">
        {text.length}/{LINE_NOTE_MAX}
      </p>
      <div role="group" aria-label="Notas frecuentes" className="flex flex-wrap gap-2">
        {QUICK_NOTES.map((quick) => (
          <button
            key={quick}
            type="button"
            onClick={() => append(quick)}
            className="min-h-11 rounded-full border-2 border-border bg-surface px-3 text-sm font-bold text-text outline-none hover:border-forest-line focus-visible:ring-2 focus-visible:ring-ring"
          >
            + {quick}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="lg" className="h-12 flex-1">
          Guardar nota
        </Button>
        {initial && (
          <Button type="button" variant="ghost" size="lg" className="h-12" onClick={() => onSave(null)}>
            Quitar nota
          </Button>
        )}
      </div>
    </form>
  );
}
