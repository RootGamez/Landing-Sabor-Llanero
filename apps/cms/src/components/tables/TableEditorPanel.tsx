import { useId, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus, Plus } from 'lucide-react';
import {
  TABLE_LABEL_MAX,
  findOverlap,
  fitsInPlan,
  tableDisplayName,
  type DiningTable,
  type PlanRect,
  type TableShape,
} from '@sabor/shared';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SegmentedControl } from '../ui/SegmentedControl';

/** Borrador editable de una mesa (lo que aún no se guardó). */
export interface TableDraft extends PlanRect {
  label: string;
  shape: TableShape;
}

const STEP_CLASS =
  'inline-flex size-11 items-center justify-center rounded-full border-2 border-border bg-surface text-text outline-none transition-colors hover:border-forest-line focus-visible:ring-2 focus-visible:ring-ring active:bg-muted disabled:opacity-40';

/** `true` si el rectángulo cabe en el plano y no pisa otra mesa activa. */
export function isValidPlacement(rect: PlanRect, others: readonly DiningTable[], selfId: number): boolean {
  return fitsInPlan(rect) && !findOverlap(rect, others, selfId);
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={STEP_CLASS}>
      {children}
    </button>
  );
}

interface TableEditorPanelProps {
  table: DiningTable;
  draft: TableDraft;
  others: readonly DiningTable[];
  dirty: boolean;
  saving: boolean;
  onChange: (draft: TableDraft) => void;
  onSave: () => void;
  onReset: () => void;
  onDeactivate: () => void;
}

/** Controles táctiles de una mesa: nombre, mover (flechas), tamaño (−/+), forma y desactivar. */
export function TableEditorPanel({ table, draft, others, dirty, saving, onChange, onSave, onReset, onDeactivate }: TableEditorPanelProps) {
  const labelId = useId();
  const name = tableDisplayName(draft.label || table.label);
  const can = (patch: Partial<PlanRect>) => isValidPlacement({ ...draft, ...patch }, others, table.id);
  const apply = (patch: Partial<TableDraft>) => onChange({ ...draft, ...patch });
  const labelValid = draft.label.trim().length > 0;

  const moves = [
    { label: `Mover ${name} hacia arriba`, patch: { y: draft.y - 1 }, icon: <ArrowUp className="size-5" aria-hidden="true" /> },
    { label: `Mover ${name} hacia la izquierda`, patch: { x: draft.x - 1 }, icon: <ArrowLeft className="size-5" aria-hidden="true" /> },
    { label: `Mover ${name} hacia la derecha`, patch: { x: draft.x + 1 }, icon: <ArrowRight className="size-5" aria-hidden="true" /> },
    { label: `Mover ${name} hacia abajo`, patch: { y: draft.y + 1 }, icon: <ArrowDown className="size-5" aria-hidden="true" /> },
  ];

  return (
    <section aria-label={`Editar ${name}`} className="flex flex-col gap-4 rounded-xl2 border-2 border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={labelId} className="font-display text-xs font-bold uppercase tracking-wide text-text-muted">
          Nombre o número
        </label>
        <Input
          id={labelId}
          value={draft.label}
          maxLength={TABLE_LABEL_MAX}
          onChange={(event) => apply({ label: event.target.value })}
          aria-invalid={labelValid ? undefined : true}
        />
        <p className="text-xs text-text-muted">Un número se muestra como “Mesa 3”; también puedes usar “Barra” o “Terraza 1”.</p>
      </div>

      <div className="flex flex-wrap gap-6">
        <div role="group" aria-label="Mover" className="flex flex-col gap-1.5">
          <span className="font-display text-xs font-bold uppercase tracking-wide text-text-muted">Mover</span>
          <div className="grid grid-cols-3 gap-1">
            <span />
            <StepButton label={moves[0]!.label} disabled={!can(moves[0]!.patch)} onClick={() => apply(moves[0]!.patch)}>
              {moves[0]!.icon}
            </StepButton>
            <span />
            {moves.slice(1).map((move) => (
              <StepButton key={move.label} label={move.label} disabled={!can(move.patch)} onClick={() => apply(move.patch)}>
                {move.icon}
              </StepButton>
            ))}
          </div>
        </div>

        <div role="group" aria-label="Tamaño" className="flex flex-col gap-1.5">
          <span className="font-display text-xs font-bold uppercase tracking-wide text-text-muted">Tamaño</span>
          {(['w', 'h'] as const).map((dim) => (
            <div key={dim} className="flex items-center gap-2">
              <span className="w-12 text-sm font-bold text-text">{dim === 'w' ? 'Ancho' : 'Alto'}</span>
              <StepButton label={`Achicar ${dim === 'w' ? 'ancho' : 'alto'} de ${name}`} disabled={!can({ [dim]: draft[dim] - 1 })} onClick={() => apply({ [dim]: draft[dim] - 1 })}>
                <Minus className="size-4" aria-hidden="true" />
              </StepButton>
              <span className="min-w-6 text-center text-lg font-bold tabular-nums" aria-live="polite">
                {draft[dim]}
              </span>
              <StepButton label={`Agrandar ${dim === 'w' ? 'ancho' : 'alto'} de ${name}`} disabled={!can({ [dim]: draft[dim] + 1 })} onClick={() => apply({ [dim]: draft[dim] + 1 })}>
                <Plus className="size-4" aria-hidden="true" />
              </StepButton>
            </div>
          ))}
        </div>
      </div>

      <SegmentedControl
        label="Forma"
        value={draft.shape}
        onValueChange={(value) => apply({ shape: value === 'round' ? 'round' : 'rect' })}
        options={[
          { value: 'rect', label: 'Rectangular' },
          { value: 'round', label: 'Redonda' },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button onClick={onSave} loading={saving} disabled={!dirty || !labelValid}>
          Guardar cambios
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={onReset} disabled={saving}>
            Deshacer
          </Button>
        )}
        <span className="flex-1" />
        <Button variant="ghost" className="text-destructive" onClick={onDeactivate} disabled={saving}>
          Desactivar mesa
        </Button>
      </div>
    </section>
  );
}
