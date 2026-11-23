import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync';
import { api } from '../../lib/api';
import type { ByCategoryRow, OrderClickRow } from '../../lib/adminTypes';
import { DateRangePicker, type DateRange } from '../ui/DateRangePicker';
import { today } from '../ui/dateUtils';
import { ReportTable } from './ReportTable';

/** Los dos reportes originales del menú web (clics de pedido y ítems por categoría). */
function WebMenuTables() {
  const [range, setRange] = useState<DateRange>({ from: '', to: '' });
  const { from, to } = range;
  const dateQuery = `${from ? `from=${from}&` : ''}${to ? `to=${to}` : ''}`;
  const orderClicks = useAsync<OrderClickRow[]>(() => api.get(`/reports/order-clicks?${dateQuery}`), [dateQuery]);
  const byCategory = useAsync<ByCategoryRow[]>(() => api.get('/reports/by-category'), []);

  return (
    <div className="flex flex-col gap-6 pt-3">
      <div className="flex flex-wrap items-end gap-3">
        <DateRangePicker label="Período" value={range} onValueChange={setRange} max={today()} clearable className="w-full max-w-xs" />
        <p className="text-xs text-text-muted">Aplica a los clics de pedido.</p>
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

/** Sección plegable: solo pide datos cuando se abre. */
export function WebMenuReports() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <section aria-label="Reportes del menú web" className="rounded-xl2 border-2 border-border bg-card p-4">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="block font-display text-base font-bold text-text">Menú web y WhatsApp</span>
          <span className="block text-xs text-text-muted">Clics en “Pedir por WhatsApp” e ítems activos por categoría</span>
        </span>
        <ChevronDown aria-hidden="true" className={`size-5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <WebMenuTables />}
    </section>
  );
}
