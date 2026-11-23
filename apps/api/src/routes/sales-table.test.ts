import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DiningTab, PaginatedResult, Sale } from '@sabor/shared';
import { api, createUser, openCash, seedMenu, type MenuFixture, type TestUser } from '../../test/pos-fixtures';
import { PAGE_SIZE_MAX } from '../lib/params';
import { chunkIds, D1_MAX_BOUND_VARIABLES, HYDRATE_CHUNK_SIZE, hydrateSales } from '../lib/sale-queries';
import type { SaleRow } from '../db/rows';

type ErrorBody = { error?: string };

const OPENED_AT = '2026-03-01 18:30:00';

async function resetAll(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM dining_tab_items'),
    env.DB.prepare('DELETE FROM dining_tabs'),
    env.DB.prepare('DELETE FROM sale_items'),
    env.DB.prepare('DELETE FROM sales'),
    env.DB.prepare('DELETE FROM cash_sessions'),
  ]);
}

describe('Sale.table (mesa de origen de la venta)', () => {
  let cashier: TestUser;
  let owner: TestUser;
  let menu: MenuFixture;
  let mesa1: number;
  let mesa2: number;

  beforeAll(async () => {
    cashier = await createUser('sale-table-cashier@test.local', 'cashier');
    owner = await createUser('sale-table-owner@test.local', 'owner');
    menu = await seedMenu();
    const idOf = async (label: string) =>
      (await env.DB.prepare('SELECT id FROM dining_tables WHERE label = ?').bind(label).first<{ id: number }>())!.id;
    mesa1 = await idOf('1');
    mesa2 = await idOf('2');
  });

  beforeEach(resetAll);

  /** Abre la cuenta de una mesa, fija su hora de apertura y la cobra. Devuelve la Sale del cobro. */
  async function payTableSale(tableId: number, openedAt = OPENED_AT): Promise<{ tabId: number; sale: Sale }> {
    const tab = await api<DiningTab>(`/tables/${tableId}/tab`, {
      token: cashier.token,
      method: 'PUT',
      body: { expectedVersion: null, items: [{ itemId: menu.gaseosa, quantity: 1 }] },
    });
    await env.DB.prepare('UPDATE dining_tabs SET opened_at = ? WHERE id = ?').bind(openedAt, tab.body.id).run();
    const paid = await api<Sale & ErrorBody>(`/tables/${tableId}/tab/close`, {
      token: cashier.token,
      method: 'POST',
      body: { tabId: tab.body.id, expectedVersion: tab.body.version },
    });
    expect(paid.status).toBe(201);
    return { tabId: tab.body.id, sale: paid.body };
  }

  const counterSale = () =>
    api<Sale & ErrorBody>('/sales', {
      token: cashier.token,
      method: 'POST',
      body: { clientUuid: crypto.randomUUID(), items: [{ itemId: menu.gaseosa, quantity: 2 }] },
    });

  it('cobrar una cuenta de mesa devuelve la Sale con table (etiqueta y apertura de la cuenta)', async () => {
    await openCash(cashier.token);
    const { tabId, sale } = await payTableSale(mesa1);
    expect(sale.table).toEqual({ tabId, tableLabel: '1', openedAt: OPENED_AT });
  });

  it('el reintento idempotente del cobro también trae table', async () => {
    await openCash(cashier.token);
    const { tabId, sale } = await payTableSale(mesa1);
    const retry = await api<Sale>(`/tables/${mesa1}/tab/close`, {
      token: cashier.token,
      method: 'POST',
      body: { tabId, expectedVersion: 1 },
    });
    expect(retry.status).toBe(200);
    expect(retry.body.id).toBe(sale.id);
    expect(retry.body.table).toEqual({ tabId, tableLabel: '1', openedAt: OPENED_AT });
  });

  it('el detalle de una venta de mesa trae table; el de mostrador trae table null', async () => {
    await openCash(cashier.token);
    const { tabId, sale } = await payTableSale(mesa2);
    const counter = await counterSale();
    expect(counter.status).toBe(201);

    const tableDetail = await api<Sale>(`/sales/${sale.id}`, { token: cashier.token });
    expect(tableDetail.body.table).toEqual({ tabId, tableLabel: '2', openedAt: OPENED_AT });
    const counterDetail = await api<Sale>(`/sales/${counter.body.id}`, { token: cashier.token });
    expect(counterDetail.body.table).toBeNull();
    expect(counter.body.table).toBeNull();
  });

  it('un lote mixto (mesa + mostrador + mesa) asigna cada table a su venta en una sola llamada', async () => {
    await openCash(cashier.token);
    const first = await payTableSale(mesa1, '2026-03-01 18:00:00');
    const counter = await counterSale();
    const second = await payTableSale(mesa2, '2026-03-01 19:15:00');

    const list = await api<PaginatedResult<Sale>>('/sales', { token: cashier.token });
    expect(list.status).toBe(200);
    const byId = new Map(list.body.items.map((s) => [s.id, s]));
    expect(byId.size).toBe(3);
    expect(byId.get(first.sale.id)!.table).toEqual({ tabId: first.tabId, tableLabel: '1', openedAt: '2026-03-01 18:00:00' });
    expect(byId.get(counter.body.id)!.table).toBeNull();
    expect(byId.get(second.sale.id)!.table).toEqual({ tabId: second.tabId, tableLabel: '2', openedAt: '2026-03-01 19:15:00' });
  });

  it('anular una venta de mesa conserva table en la respuesta', async () => {
    await openCash(cashier.token);
    const { tabId, sale } = await payTableSale(mesa1);
    const voided = await api<Sale>(`/sales/${sale.id}/void`, {
      token: owner.token,
      method: 'POST',
      body: { reason: 'Error de cobro' },
    });
    expect(voided.status).toBe(200);
    expect(voided.body.voidedAt).not.toBeNull();
    expect(voided.body.table).toEqual({ tabId, tableLabel: '1', openedAt: OPENED_AT });
  });

  it('hydrateSales resuelve las mesas con UN solo SELECT extra por lote (sin N+1)', async () => {
    await openCash(cashier.token);
    await payTableSale(mesa1);
    await counterSale();
    await payTableSale(mesa2);
    const { results } = await env.DB.prepare('SELECT * FROM sales ORDER BY id').all<SaleRow>();
    expect(results).toHaveLength(3);

    const queries: string[] = [];
    const spyDb = {
      prepare: (sql: string) => {
        queries.push(sql);
        return env.DB.prepare(sql);
      },
    } as unknown as D1Database;
    const sales = await hydrateSales(spyDb, results);

    expect(queries).toHaveLength(2);
    expect(sales.map((s) => s.table?.tableLabel ?? null)).toEqual(['1', null, '2']);
  });

  it('hydrateSales parte una página máxima (PAGE_SIZE_MAX) en lotes bajo el tope de variables de D1', async () => {
    expect(HYDRATE_CHUNK_SIZE).toBeLessThan(D1_MAX_BOUND_VARIABLES);
    await openCash(cashier.token);
    await payTableSale(mesa1);
    await payTableSale(mesa2);
    const { results } = await env.DB.prepare('SELECT * FROM sales ORDER BY id').all<SaleRow>();
    const [first, last] = results;
    // Ventas ficticias (ids que no existen) en medio: la primera y la última caen en lotes distintos.
    const filler = Array.from({ length: PAGE_SIZE_MAX - 2 }, (_, index) => ({ ...first!, id: 900_000 + index }));
    const rows = [first!, ...filler, last!];
    expect(rows).toHaveLength(PAGE_SIZE_MAX);

    const boundCounts: number[] = [];
    const spyDb = {
      prepare: (sql: string) => {
        const statement = env.DB.prepare(sql);
        return {
          bind: (...values: unknown[]) => {
            boundCounts.push(values.length);
            return statement.bind(...values);
          },
        };
      },
    } as unknown as D1Database;
    const sales = await hydrateSales(spyDb, rows);

    expect(boundCounts).toHaveLength(2 * Math.ceil(PAGE_SIZE_MAX / HYDRATE_CHUNK_SIZE));
    expect(Math.max(...boundCounts)).toBeLessThanOrEqual(HYDRATE_CHUNK_SIZE);
    expect(sales).toHaveLength(PAGE_SIZE_MAX);
    expect(sales[0]!.table?.tableLabel).toBe('1');
    expect(sales[0]!.items).toHaveLength(1);
    expect(sales[PAGE_SIZE_MAX - 1]!.table?.tableLabel).toBe('2');
    expect(sales[PAGE_SIZE_MAX - 1]!.items).toHaveLength(1);
  });

  it('chunkIds respeta el tamaño de lote y no muta la lista', () => {
    const ids = Array.from({ length: 181 }, (_, index) => index + 1);
    const chunks = chunkIds(ids, HYDRATE_CHUNK_SIZE);
    expect(chunks.map((chunk) => chunk.length)).toEqual([90, 90, 1]);
    expect(chunks.flat()).toEqual(ids);
    expect(chunkIds([])).toEqual([]);
  });

  it('hydrateSales con lista vacía no consulta nada', async () => {
    const queries: string[] = [];
    const spyDb = {
      prepare: (sql: string) => {
        queries.push(sql);
        return env.DB.prepare(sql);
      },
    } as unknown as D1Database;
    expect(await hydrateSales(spyDb, [])).toEqual([]);
    expect(queries).toHaveLength(0);
  });
});
