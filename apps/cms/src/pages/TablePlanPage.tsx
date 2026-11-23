import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ShoppingCart } from 'lucide-react';
import {
  findFreeSpot,
  planRows,
  tableDisplayName,
  type DiningTable,
  type DiningTableStatus,
} from '@sabor/shared';
import { PlanCanvas } from '../components/tables/PlanCanvas';
import { TableEditorPanel, type TableDraft } from '../components/tables/TableEditorPanel';
import { Button } from '../components/ui/Button';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { useMutation } from '../hooks/useMutation';
import { useTableStatuses } from '../hooks/useTables';
import { createTable, updateTable } from '../lib/tablesApi';
import { planBox } from '../lib/tableTab';
import { cn } from '../lib/utils';
import { toastError, toastSuccess } from '../store/toastStore';

const NEW_TABLE_W = 2;
const NEW_TABLE_H = 2;

function toDraft(table: DiningTable): TableDraft {
  return { label: table.label, x: table.x, y: table.y, w: table.w, h: table.h, shape: table.shape };
}

function sameDraft(a: TableDraft, b: TableDraft): boolean {
  return a.label.trim() === b.label.trim() && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && a.shape === b.shape;
}

/** Siguiente número libre ("6" si ya existen 1–5). */
function nextLabel(tables: readonly DiningTable[]): string {
  const numbers = tables.map((t) => Number(t.label)).filter((n) => Number.isInteger(n) && n > 0);
  return String((numbers.length ? Math.max(...numbers) : 0) + 1);
}

function EditorTile({
  table,
  rows,
  selected,
  onSelect,
}: {
  table: DiningTable;
  rows: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li className="absolute p-1" style={planBox(table, rows)}>
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${tableDisplayName(table.label)}${selected ? ', seleccionada' : ''}`}
        onClick={onSelect}
        className={cn(
          'flex size-full min-h-11 min-w-11 items-center justify-center border-2 font-display text-xl font-extrabold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          table.shape === 'round' ? 'rounded-full' : 'rounded-xl',
          selected ? 'border-forest bg-accent text-accent-foreground shadow-sticker' : 'border-forest-line/60 bg-surface text-text hover:bg-lime-soft/50',
        )}
      >
        {table.label}
      </button>
    </li>
  );
}

/** Plano de mesas (owner/admin): agregar, renombrar, mover, cambiar tamaño/forma y activar/desactivar. */
export function TablePlanPage() {
  const tables = useTableStatuses({ includeInactive: true, poll: false });
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<TableDraft | null>(null);
  const save = useMutation(updateTable);
  const create = useMutation(createTable);

  const all: DiningTableStatus[] = tables.data ?? [];
  const active = all.filter((t) => t.isActive);
  const inactive = all.filter((t) => !t.isActive);
  const selected = active.find((t) => t.id === selectedId) ?? null;
  // En el plano se dibuja el borrador de la mesa seleccionada, para ver el cambio antes de guardar.
  const shown = active.map((t) => (t.id === selectedId && draft ? { ...t, ...draft, label: draft.label || t.label } : t));
  const rows = planRows(shown);
  const dirty = selected !== null && draft !== null && !sameDraft(draft, toDraft(selected));

  async function select(table: DiningTable) {
    if (dirty && table.id !== selectedId) {
      const discard = await confirm({ title: 'Tienes cambios sin guardar', description: 'Si cambias de mesa se descartan.', confirmLabel: 'Descartar' });
      if (!discard) return;
    }
    setSelectedId(table.id);
    setDraft(toDraft(table));
  }

  async function saveDraft() {
    if (!selected || !draft) return;
    const result = await save.mutate(selected.id, { ...draft, label: draft.label.trim() });
    if (!result) return;
    toastSuccess(`${tableDisplayName(result.label)} guardada`);
    setDraft(toDraft(result));
    tables.refetch();
  }

  async function setActive(table: DiningTable, isActive: boolean) {
    if (!isActive) {
      const ok = await confirm({
        title: `¿Desactivar ${tableDisplayName(table.label)}?`,
        description: 'Deja de aparecer en el mapa del POS. Puedes volver a activarla cuando quieras.',
        confirmLabel: 'Desactivar',
      });
      if (!ok) return;
    }
    const result = await save.mutate(table.id, { isActive });
    if (!result) return;
    toastSuccess(`${tableDisplayName(result.label)} ${isActive ? 'activada' : 'desactivada'}`);
    if (!isActive) {
      setSelectedId(null);
      setDraft(null);
    }
    tables.refetch();
  }

  async function addTable() {
    const spot = findFreeSpot(NEW_TABLE_W, NEW_TABLE_H, active);
    if (!spot) {
      toastError('No queda espacio libre en el plano. Achica o mueve alguna mesa.');
      return;
    }
    const result = await create.mutate({ label: nextLabel(all), ...spot, shape: 'rect' });
    if (!result) return;
    toastSuccess(`${tableDisplayName(result.label)} agregada`);
    tables.refetch();
    setSelectedId(result.id);
    setDraft(toDraft(result));
  }

  let body;
  if (tables.data === undefined) {
    body = tables.error ? <ErrorState message={tables.error} onRetry={tables.refetch} /> : <Skeleton className="aspect-[3/2] w-full" />;
  } else {
    body = (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-3">
          {active.length === 0 ? (
            <EmptyState title="No hay mesas activas" description="Agrega una mesa o activa una de las desactivadas." />
          ) : (
            <PlanCanvas rows={rows} showGrid label="Plano de mesas (edición)" className="max-w-none">
              {shown.map((table) => (
                <EditorTile key={table.id} table={table} rows={rows} selected={table.id === selectedId} onSelect={() => void select(table)} />
              ))}
            </PlanCanvas>
          )}
          <p className="text-sm text-text-muted">Toca una mesa para editarla. Cada cuadro de la cuadrícula es una unidad de tamaño.</p>
        </div>
        <div className="flex flex-col gap-4">
          {selected && draft ? (
            <TableEditorPanel
              table={selected}
              draft={draft}
              others={active}
              dirty={dirty}
              saving={save.loading}
              onChange={setDraft}
              onSave={() => void saveDraft()}
              onReset={() => setDraft(toDraft(selected))}
              onDeactivate={() => void setActive(selected, false)}
            />
          ) : (
            <p className="rounded-xl2 border-2 border-dashed border-border p-4 text-sm text-text-muted">
              Selecciona una mesa del plano para moverla, cambiar su tamaño, su forma o su nombre.
            </p>
          )}
          {inactive.length > 0 && (
            <section aria-labelledby="inactive-tables" className="flex flex-col gap-2">
              <h2 id="inactive-tables" className="font-display text-sm font-bold uppercase tracking-wide text-text">
                Mesas desactivadas
              </h2>
              <ul className="flex flex-col gap-2">
                {inactive.map((table) => (
                  <li key={table.id} className="flex items-center justify-between gap-2 rounded-xl border-2 border-border bg-card px-3 py-2">
                    <span className="font-bold text-text">{tableDisplayName(table.label)}</span>
                    <Button variant="outline" size="sm" className="h-11" onClick={() => void setActive(table, true)} disabled={save.loading}>
                      Activar
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Plano de mesas</h1>
          <p className="text-sm text-text-muted">Así se ve el local en el modo Mesas del punto de venta.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/ventas/pos?modo=mesas">
              <ShoppingCart aria-hidden="true" />
              Ir a Mesas
            </Link>
          </Button>
          <Button variant="accent" onClick={() => void addTable()} loading={create.loading} disabled={tables.data === undefined}>
            <Plus aria-hidden="true" />
            Agregar mesa
          </Button>
        </div>
      </div>
      {body}
    </div>
  );
}
