import { useState, type FormEvent } from 'react';
import { todayLocal, type Expense, type ExpenseUpdateInput, type PaymentMethod } from '@sabor/shared';
import { useFieldErrors } from '../../hooks/useFieldErrors';
import { useMutation } from '../../hooks/useMutation';
import { updateExpense } from '../../lib/expensesApi';
import { toastSuccess } from '../../store/toastStore';
import { Button } from '../ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { SelectField, TextField } from '../ui/FormField';
import { AmountInput } from './AmountInput';
import { amountErrorMessage, centsToAmountText, parseAmountToCents, type CategoryOption } from './expenseUtils';
import { PaidFromRegisterToggle } from './PaidFromRegisterToggle';

const CASH_KEY = 'efectivo';

interface ExpenseEditDialogProps {
  expense: Expense;
  categories: readonly CategoryOption[];
  methods: readonly PaymentMethod[];
  hasOpenCash: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** Solo los campos que cambiaron: el PATCH nunca pisa lo que no se tocó. */
function buildPatch(expense: Expense, next: Required<ExpenseUpdateInput>): ExpenseUpdateInput {
  const patch: ExpenseUpdateInput = {};
  if (next.amountCents !== expense.amountCents) patch.amountCents = next.amountCents;
  if (next.date !== expense.date) patch.date = next.date;
  if (next.categoryId !== expense.categoryId) patch.categoryId = next.categoryId;
  if (next.description !== expense.description) patch.description = next.description;
  if (next.paymentMethod !== expense.paymentMethod) patch.paymentMethod = next.paymentMethod;
  if (next.paidFromRegister !== expense.paidFromRegister) patch.paidFromRegister = next.paidFromRegister;
  return patch;
}

/** Edición de un gasto. Montar con `key={expense.id}` para reiniciar el estado al cambiar de gasto. */
export function ExpenseEditDialog({ expense, categories, methods, hasOpenCash, onClose, onSaved }: ExpenseEditDialogProps) {
  const [amount, setAmount] = useState(centsToAmountText(expense.amountCents));
  const [date, setDate] = useState(expense.date);
  const [categoryId, setCategoryId] = useState(expense.categoryId);
  const [note, setNote] = useState(expense.description);
  const [method, setMethod] = useState(expense.paymentMethod);
  const [paid, setPaid] = useState(expense.paidFromRegister);
  const { mutate: save, loading } = useMutation((patch: ExpenseUpdateInput) => updateExpense(expense.id, patch));

  const amountCents = parseAmountToCents(amount);
  const { error, touch, validate } = useFieldErrors({
    'ee-amount': amountErrorMessage(amount),
    'ee-date': date ? null : 'Elige la fecha del gasto',
  });
  // Una categoría desactivada se puede conservar, pero no elegir de nuevo.
  const options = categories.filter((option) => option.isActive || option.id === expense.categoryId);

  function chooseMethod(next: string) {
    setMethod(next);
    if (next !== CASH_KEY) setPaid(false);
  }

  function chooseRegisterCash(next: boolean) {
    setPaid(next);
    if (next) setMethod(CASH_KEY);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate() || amountCents === null) return;
    const patch = buildPatch(expense, {
      amountCents,
      date,
      categoryId,
      description: note.trim(),
      paymentMethod: method,
      paidFromRegister: paid,
    });
    if (Object.keys(patch).length === 0) return onClose();
    const saved = await save(patch);
    if (!saved) return;
    toastSuccess('Gasto actualizado');
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>Editar gasto</DialogTitle>
        <DialogDescription>Corrige los datos y guarda. El total de la caja se recalcula si el gasto era de caja.</DialogDescription>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <AmountInput id="ee-amount" value={amount} onChange={setAmount} onBlur={() => touch('ee-amount')} error={error('ee-amount')} />
          <TextField
            id="ee-date"
            label="Fecha"
            type="date"
            value={date}
            max={todayLocal()}
            onChange={(event) => setDate(event.target.value)}
            onBlur={() => touch('ee-date')}
            error={error('ee-date')}
          />
          <SelectField id="ee-category" label="Categoría" value={categoryId} onChange={(event) => setCategoryId(Number(event.target.value))}>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
                {option.isActive ? '' : ' (desactivada)'}
              </option>
            ))}
          </SelectField>
          <SelectField id="ee-method" label="Método de pago" value={method} onChange={(event) => chooseMethod(event.target.value)}>
            {!methods.some((m) => m.key === expense.paymentMethod) && (
              <option value={expense.paymentMethod}>{expense.paymentMethod}</option>
            )}
            {methods.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </SelectField>
          {(hasOpenCash || expense.paidFromRegister) && (
            <PaidFromRegisterToggle id="ee-paid" checked={paid} onChange={chooseRegisterCash} />
          )}
          <TextField
            id="ee-detail"
            label="Detalle (opcional)"
            placeholder="Ej.: queso mozzarella 5 kg"
            value={note}
            maxLength={200}
            autoComplete="off"
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent" loading={loading}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
