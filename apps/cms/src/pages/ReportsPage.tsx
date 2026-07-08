import { useState } from 'react';
import { useAsync } from '../hooks/useAsync';
import { api } from '../lib/api';
import type { ByCategoryRow, OrderClickRow } from '../lib/adminTypes';
import { ReportTable } from '../components/reports/ReportTable';
import { TextField } from '../components/ui/FormField';

/**
 * Los 2 reportes que expone la API (apps/api/src/routes/reports.ts):
 * order-clicks (filtrable por fecha) y by-category. Sin low-stock ni
 * most-viewed — este catálogo no tiene stock y no registra vistas.
 */
export function ReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const dateQuery = `${from ? `from=${from}&` : ''}${to ? `to=${to}` : ''}`;

  const orderClicks = useAsync<OrderClickRow[]>(
    () => api.get(`/reports/order-clicks?${dateQuery}`),
    [dateQuery],
  );
  const byCategory = useAsync<ByCategoryRow[]>(() => api.get('/reports/by-category'), []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Reportes</h1>
        <div className="mt-3 flex flex-wrap gap-3">
          <TextField label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField label="Hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <p className="self-end text-xs text-text-muted">Aplica a los clics de pedido.</p>
        </div>
      </div>

      <ReportTable
        title="Clics en 'Pedir por WhatsApp'"
        rows={orderClicks.data}
        loading={orderClicks.loading}
        columns={[
          { key: 'nameEs', label: 'Ítem' },
          { key: 'clicks', label: 'Clics' },
        ]}
      />

      <ReportTable
        title="Ítems activos por categoría"
        rows={byCategory.data}
        loading={byCategory.loading}
        columns={[
          { key: 'nameEs', label: 'Categoría' },
          { key: 'total', label: 'Total' },
        ]}
      />
    </div>
  );
}
