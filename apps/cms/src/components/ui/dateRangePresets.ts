import { addDays, addMonths, endOfMonth, startOfMonth, today } from './dateUtils';

export interface DateRange {
  /** 'YYYY-MM-DD' o ''. */
  from: string;
  to: string;
}

export interface DatePreset {
  id: string;
  label: string;
  range: () => DateRange;
}

/** Atajos habituales de un panel de ventas (día de Lima). */
export const DEFAULT_DATE_PRESETS: readonly DatePreset[] = [
  { id: 'today', label: 'Hoy', range: () => ({ from: today(), to: today() }) },
  {
    id: 'yesterday',
    label: 'Ayer',
    range: () => ({ from: addDays(today(), -1), to: addDays(today(), -1) }),
  },
  { id: 'last7', label: 'Últimos 7 días', range: () => ({ from: addDays(today(), -6), to: today() }) },
  { id: 'last30', label: 'Últimos 30 días', range: () => ({ from: addDays(today(), -29), to: today() }) },
  {
    id: 'thisMonth',
    label: 'Este mes',
    range: () => ({ from: startOfMonth(today()), to: today() }),
  },
  {
    id: 'lastMonth',
    label: 'Mes pasado',
    range: () => {
      const previous = addMonths(startOfMonth(today()), -1);
      return { from: startOfMonth(previous), to: endOfMonth(previous) };
    },
  },
];
