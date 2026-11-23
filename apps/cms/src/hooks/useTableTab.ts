import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import type { DiningTab } from '@sabor/shared';
import { ApiError } from '../lib/api';
import { toSaleItems } from '../lib/posCart';
import { fetchTableTab, saveTableTab } from '../lib/tablesApi';
import { isDraftDirty, lockedTabItems, newUnitsCount, rebaseDraft, savedQuantities, tabToCartLines } from '../lib/tableTab';
import { createTableCartStore } from '../store/posCartStore';
import { toastError, toastSuccess } from '../store/toastStore';
import { TABLES_POLL_MS, usePolling } from './useTables';

const CONFLICT_MESSAGE =
  'Otra persona actualizó esta mesa. Se cargó la cuenta actual y se mantuvieron tus productos nuevos: revisa y vuelve a guardar.';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error';
}

/**
 * Cuenta de una mesa: la versión guardada en el servidor (`tab`) + un ticket
 * editable en memoria (`store`) que reutilizan los componentes del POS.
 * Mientras no haya cambios sin guardar, se refresca solo (otro dispositivo
 * pudo agregar productos); con cambios, se pausa para no pisarlos.
 */
export function useTableTab(tableId: number, tableName: string) {
  const [store] = useState(() => createTableCartStore([]));
  /** `undefined` = cargando; `null` = mesa libre (sin cuenta abierta). */
  const [tab, setTab] = useState<DiningTab | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const lines = useStore(store, (s) => s.lines);
  const saved = useMemo(() => savedQuantities(tab ?? null), [tab]);
  const dirty = tab !== undefined && isDraftDirty(lines, saved);

  const applyServerTab = useCallback(
    (next: DiningTab | null) => {
      setTab(next);
      store.getState().replaceLines(tabToCartLines(next));
    },
    [store],
  );

  const reload = useCallback(async () => {
    try {
      const next = await fetchTableTab(tableId);
      setLoadError(null);
      // Solo se pisa el ticket si no hay cambios locales pendientes.
      const state = store.getState();
      const current = savedQuantities(tab ?? null);
      if (tab === undefined || !isDraftDirty(state.lines, current)) applyServerTab(next);
      return next;
    } catch (err) {
      setLoadError(errorMessage(err));
      return undefined;
    }
  }, [tableId, store, tab, applyServerTab]);

  useEffect(() => {
    void reload();
    // Solo al montar: los refrescos siguientes los dispara el polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  usePolling(() => void reload(), TABLES_POLL_MS, tab !== undefined && !dirty && !saving);

  async function save(): Promise<boolean> {
    if (tab === undefined || saving) return false;
    const currentLines = store.getState().lines;
    if (currentLines.length === 0) return false;
    setSaving(true);
    try {
      const next = await saveTableTab(tableId, { expectedVersion: tab?.version ?? null, items: toSaleItems(currentLines) });
      const added = newUnitsCount(currentLines, saved);
      applyServerTab(next);
      toastSuccess(added > 0 ? `${tableName}: pedido guardado (${added} nuevo${added === 1 ? '' : 's'})` : `${tableName}: cuenta actualizada`);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        await rebaseAfterConflict(currentLines);
        toastError(CONFLICT_MESSAGE);
      } else {
        toastError(errorMessage(err));
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function rebaseAfterConflict(localLines: ReturnType<typeof store.getState>['lines']) {
    try {
      const latest = await fetchTableTab(tableId);
      setTab(latest);
      store.getState().replaceLines(rebaseDraft(saved, localLines, tabToCartLines(latest)));
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }

  function discardChanges() {
    store.getState().replaceLines(tabToCartLines(tab ?? null));
  }

  const lockedItems = lockedTabItems(tab ?? null);
  return {
    store,
    tab,
    loadError,
    lines,
    saved,
    dirty,
    saving,
    newUnits: newUnitsCount(lines, saved),
    lockedCents: lockedItems.reduce((sum, item) => sum + item.lineTotalCents, 0),
    save,
    reload,
    discardChanges,
    applyServerTab,
  };
}
