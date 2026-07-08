import { useAsync } from '../hooks/useAsync';
import { useCollections } from '../hooks/useCmsData';
import { api } from '../lib/api';
import type { OrderClickRow } from '../lib/adminTypes';
import { CollectionEditor } from '../components/merchandising/CollectionEditor';
import { TableSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';

/**
 * Merchandising del catálogo: las 3 colecciones fijas (top_sellers "Los más
 * pedidos", daily_featured "Destacados del día", promos "Promos especiales").
 * El dueño no crea ni borra colecciones — solo edita títulos/activo y cura la
 * lista de ítems de cada una. El conteo de order_clicks se muestra junto a
 * cada ítem para ayudar a decidir qué poner en "más pedidos".
 */
export function MerchandisingPage() {
  const { data: collections, loading, error, refetch } = useCollections();
  // Barato: un solo GET admin ya existente; si falla, la página funciona igual sin conteos.
  const { data: clicks } = useAsync<OrderClickRow[]>(() => api.get('/reports/order-clicks'), []);

  const clicksByItem = new Map((clicks ?? []).map((row) => [row.itemId, row.clicks]));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Destacados del catálogo</h1>
        <p className="text-sm text-text-muted">
          Armá las vitrinas del menú: los más pedidos, los destacados del día y las promos
          especiales. Cada colección admite hasta 20 ítems, en el orden que elijas.
        </p>
      </div>

      {loading && <TableSkeleton rows={6} />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!loading && !error && collections && collections.length === 0 && (
        <p className="text-sm text-text-muted">
          No hay colecciones en la base. Corré el seed de la API (0002_collections.sql).
        </p>
      )}
      {!loading &&
        !error &&
        collections?.map((collection) => (
          <CollectionEditor
            key={collection.key}
            collection={collection}
            clicksByItem={clicksByItem}
            onChange={refetch}
          />
        ))}
    </div>
  );
}
