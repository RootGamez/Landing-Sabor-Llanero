import type {
  Expense,
  ExpenseCategory,
  ExpenseCategoryInput,
  ExpenseCategoryNode,
  ExpenseCategoryUpdateInput,
  ExpenseInput,
  ExpenseListResult,
  ExpenseUpdateInput,
  PaymentMethod,
} from '@sabor/shared';
import { api } from './api';

export interface ExpenseFilterValues {
  from: string;
  to: string;
  categoryId: number | null;
  paymentMethod: string;
  q: string;
}

/** Arma el query string del listado omitiendo los filtros vacíos. */
export function expenseListQuery(filters: ExpenseFilterValues, page: number, pageSize: number): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.categoryId !== null) params.set('category_id', String(filters.categoryId));
  if (filters.paymentMethod) params.set('payment_method', filters.paymentMethod);
  if (filters.q.trim()) params.set('q', filters.q.trim());
  return params.toString();
}

export const fetchExpenses = (filters: ExpenseFilterValues, page: number, pageSize: number) =>
  api.get<ExpenseListResult>(`/expenses?${expenseListQuery(filters, page, pageSize)}`);

export const createExpense = (input: ExpenseInput) => api.post<Expense>('/expenses', input);

export const updateExpense = (id: number, input: ExpenseUpdateInput) =>
  api.patch<Expense>(`/expenses/${id}`, input);

export const deleteExpense = (id: number) => api.delete<{ id: number }>(`/expenses/${id}`);

export const fetchExpenseCategories = () => api.get<ExpenseCategoryNode[]>('/expense-categories');

export const createExpenseCategory = (input: ExpenseCategoryInput) =>
  api.post<ExpenseCategory>('/expense-categories', input);

export const updateExpenseCategory = (id: number, input: ExpenseCategoryUpdateInput) =>
  api.patch<ExpenseCategory>(`/expense-categories/${id}`, input);

export const deleteExpenseCategory = (id: number) => api.delete<{ id: number }>(`/expense-categories/${id}`);

export const fetchActivePaymentMethods = () => api.get<PaymentMethod[]>('/payment-methods');

/** Solo interesa saber si hay una caja abierta (habilita "Pagado con efectivo de caja"). */
export const fetchHasOpenCash = async (): Promise<boolean> =>
  (await api.get<{ id: number } | null>('/cash-sessions/current')) !== null;
