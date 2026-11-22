import { useEffect, useState } from 'react';
import {
  fetchActivePaymentMethods,
  fetchExpenseCategories,
  fetchExpenses,
  fetchHasOpenCash,
  type ExpenseFilterValues,
} from '../lib/expensesApi';
import { useAsync } from './useAsync';

const SEARCH_DEBOUNCE_MS = 300;

/** Valor retrasado: evita una consulta por cada tecla en la búsqueda. */
export function useDebouncedValue<T>(value: T, delayMs: number = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function useExpenseCategories() {
  return useAsync(fetchExpenseCategories, []);
}

export function useActivePaymentMethods() {
  return useAsync(fetchActivePaymentMethods, []);
}

export function useHasOpenCash() {
  return useAsync(fetchHasOpenCash, []);
}

export function useExpenseList(filters: ExpenseFilterValues, page: number, pageSize: number) {
  const { from, to, categoryId, paymentMethod, q } = filters;
  return useAsync(
    () => fetchExpenses({ from, to, categoryId, paymentMethod, q }, page, pageSize),
    [from, to, categoryId, paymentMethod, q, page, pageSize],
  );
}
