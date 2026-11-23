import { memo } from 'react';
import { AlertTriangle, CircleDashed, Users } from 'lucide-react';
import { formatPEN, planRows, tableDisplayName, type DiningTableStatus } from '@sabor/shared';
import { formatElapsed, formatOpenedAgo, isStaleTab, planBox } from '../../lib/tableTab';
import { cn } from '../../lib/utils';
import { PlanCanvas } from './PlanCanvas';

type TileState = 'free' | 'busy' | 'stale';

function tileState(table: DiningTableStatus, now: number): TileState {
  if (!table.openTab) return 'free';
  return isStaleTab(table.openTab.openedAt, now) ? 'stale' : 'busy';
}

const STATE_CLASS: Record<TileState, string> = {
  free: 'border-dashed border-forest-line/50 bg-surface text-text hover:border-forest hover:bg-lime-soft/40',
  busy: 'border-forest bg-accent text-accent-foreground shadow-sticker',
  stale: 'border-sky-strong bg-sky-soft text-text shadow-sticker-sky',
};

const STATE_TEXT: Record<TileState, string> = { free: 'Libre', busy: 'Ocupada', stale: 'Revisar' };

/** "Mesa 3, ocupada, S/ 45.00, 4 productos, abierta hace 25 min". */
export function tableAriaLabel(table: DiningTableStatus, now: number): string {
  const name = tableDisplayName(table.label);
  if (!table.openTab) return `${name}, libre`;
  const { totalCents, itemCount, openedAt } = table.openTab;
  const stale = isStaleTab(openedAt, now) ? ', abierta hace mucho: revisar' : '';
  return `${name}, ocupada, ${formatPEN(totalCents)}, ${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}, ${formatOpenedAgo(openedAt, now)}${stale}`;
}

function StateIcon({ state }: { state: TileState }) {
  const Icon = state === 'free' ? CircleDashed : state === 'busy' ? Users : AlertTriangle;
  return <Icon className="size-3.5 shrink-0" aria-hidden="true" />;
}

interface TableTileProps {
  table: DiningTableStatus;
  rows: number;
  now: number;
  onSelect: (table: DiningTableStatus) => void;
}

const TableTile = memo(function TableTile({ table, rows, now, onSelect }: TableTileProps) {
  const state = tileState(table, now);
  return (
    <li className="absolute p-1" style={planBox(table, rows)}>
      <button
        type="button"
        aria-label={tableAriaLabel(table, now)}
        onClick={() => onSelect(table)}
        className={cn(
          '@container flex size-full min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 overflow-hidden border-2 px-1 text-center outline-none select-none touch-manipulation',
          'transition-[transform,filter] duration-150 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          table.shape === 'round' ? 'rounded-full' : 'rounded-xl',
          STATE_CLASS[state],
        )}
      >
        <span className="font-display text-xl font-extrabold leading-none @min-[5.5rem]:text-2xl">{table.label}</span>
        {/* Estado = icono (siempre) + texto: "Libre", o el total de la cuenta si está ocupada. */}
        <span className="flex max-w-full items-center gap-1 text-[11px] font-bold uppercase leading-tight tracking-wide">
          <StateIcon state={state} />
          <span className="hidden truncate tabular-nums @min-[4.5rem]:inline">
            {table.openTab ? formatPEN(table.openTab.totalCents) : STATE_TEXT[state]}
          </span>
        </span>
        {table.openTab && (
          <span className="hidden max-w-full truncate text-[11px] font-medium @min-[9rem]:block">
            {STATE_TEXT[state]} · {formatElapsed(table.openTab.openedAt, now)}
          </span>
        )}
      </button>
    </li>
  );
});

interface TableMapProps {
  tables: readonly DiningTableStatus[];
  now: number;
  onSelect: (table: DiningTableStatus) => void;
}

/** Plano del local con el estado de cada mesa (libre / ocupada / por revisar): texto + icono, no solo color. */
export function TableMap({ tables, now, onSelect }: TableMapProps) {
  const rows = planRows(tables);
  return (
    <PlanCanvas rows={rows} label="Plano de mesas">
      {tables.map((table) => (
        <TableTile key={table.id} table={table} rows={rows} now={now} onSelect={onSelect} />
      ))}
    </PlanCanvas>
  );
}

export function MapLegend() {
  const items: Array<{ state: TileState; label: string }> = [
    { state: 'free', label: 'Libre' },
    { state: 'busy', label: 'Ocupada' },
    { state: 'stale', label: 'Abierta hace +12 h' },
  ];
  return (
    <ul aria-label="Leyenda" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-text-muted">
      {items.map((item) => (
        <li key={item.state} className="flex items-center gap-1.5">
          <span className={cn('inline-flex size-5 items-center justify-center rounded-md border-2', STATE_CLASS[item.state])}>
            <StateIcon state={item.state} />
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Cuentas abiertas en lista (más antigua primero): el detalle que no entra en una mesa chica del plano. */
export function OpenTabsList({ tables, now, onSelect }: TableMapProps) {
  const open = tables
    .filter((table): table is DiningTableStatus & { openTab: NonNullable<DiningTableStatus['openTab']> } => table.openTab !== null)
    .sort((a, b) => a.openTab.openedAt.localeCompare(b.openTab.openedAt));
  const totalCents = open.reduce((sum, table) => sum + table.openTab.totalCents, 0);

  return (
    <section aria-labelledby="open-tabs-title" className="mx-auto flex w-full max-w-3xl flex-col gap-2">
      <h2 id="open-tabs-title" className="flex items-baseline justify-between gap-2 font-display text-sm font-bold uppercase tracking-wide text-text">
        <span>Cuentas abiertas ({open.length})</span>
        {open.length > 0 && (
          <span className="text-xs font-medium normal-case text-text-muted">
            Por cobrar: <span className="font-bold tabular-nums text-text">{formatPEN(totalCents)}</span>
          </span>
        )}
      </h2>
      {open.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm text-text-muted">
          Todas las mesas están libres. Toca una mesa del plano para tomar un pedido.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {open.map((table) => {
            const stale = isStaleTab(table.openTab.openedAt, now);
            return (
              <li key={table.id}>
                <button
                  type="button"
                  onClick={() => onSelect(table)}
                  aria-label={tableAriaLabel(table, now)}
                  className={cn(
                    'flex min-h-12 w-full items-center gap-3 rounded-xl border-2 bg-card px-3 text-left outline-none transition-colors hover:border-forest focus-visible:ring-2 focus-visible:ring-ring',
                    stale ? 'border-sky-strong' : 'border-border',
                  )}
                >
                  <span className="font-display text-base font-extrabold text-text">{tableDisplayName(table.label)}</span>
                  <span className="flex items-center gap-1 text-xs text-text-muted">
                    {stale && <AlertTriangle className="size-3.5 text-sky-strong" aria-hidden="true" />}
                    {formatElapsed(table.openTab.openedAt, now)}
                    {stale && <span className="font-bold text-sky-strong">· revisar</span>}
                  </span>
                  <span className="flex-1" />
                  <span className="text-base font-extrabold tabular-nums text-text">{formatPEN(table.openTab.totalCents)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
