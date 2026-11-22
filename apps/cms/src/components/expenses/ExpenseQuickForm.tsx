import { useRef, useState, type FormEvent } from 'react';
import { todayLocal, formatPEN, type PaymentMethod } from '@sabor/shared';
import { useFieldErrors } from '../../hooks/useFieldErrors';
import { useMutation } from '../../hooks/useMutation';
import { createExpense } from '../../lib/expensesApi';
import { toastSuccess } from '../../store/toastStore';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/card';
import { SelectField, TextField } from '../ui/FormField';
import { AmountInput } from './AmountInput';
import { ChipGroup } from './ChipGroup';
import { parseAmountToCents, topCategories, type CategoryOption } from './expenseUtils';
import { PaidFromRegisterToggle } from './PaidFromRegisterToggle';

const CASH_KEY = 'efectivo';
const NOTE_MAX = 200;

interface ExpenseQuickFormProps {
  categories: readonly CategoryOption[];
  methods: readonly PaymentMethod[];
  hasOpenCash: boolean;
  onSaved: () => void;
}

/**
 * Registro rápido (objetivo < 15 s): monto → categoría (chips) → Enter. Tras
 * guardar se conserva categoría, fecha y método y el foco vuelve al monto para
 * anotar el siguiente gasto sin tocar nada más.
 */
export function ExpenseQuickForm({ categories, methods, hasOpenCash, onSaved }: ExpenseQuickFormProps) {
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [date, setDate] = useState(() => todayLocal());
  const [note, setNote] = useState('');
  const [method, setMethod] = useState(CASH_KEY);
  const [paidFromRegister, setPaidFromRegister] = useState(false);
  const { mutate: save, loading } = useMutation(createExpense);

  const amountCents = parseAmountToCents(amount);
  const { error, touch, validate, reset } = useFieldErrors({
    'qe-amount': amountCents === null ? 'Ingresa un monto mayor a 0 (ej. 12.50)' : null,
    'qe-category': categoryId === null ? 'Elige una categoría' : null,
    'qe-date': date ? null : 'Elige la fecha del gasto',
  });

  const selectableCategories = categories.filter((option) => option.isActive);

  function chooseMethod(next: string) {
    setMethod(next);
    if (next !== CASH_KEY) setPaidFromRegister(false);
  }

  function chooseRegisterCash(next: boolean) {
    setPaidFromRegister(next);
    if (next) setMethod(CASH_KEY);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate() || amountCents === null || categoryId === null) return;
    const saved = await save({
      date,
      amountCents,
      categoryId,
      description: note.trim(),
      paymentMethod: method,
      paidFromRegister: hasOpenCash && paidFromRegister,
    });
    if (!saved) return;
    toastSuccess(`Gasto guardado: ${formatPEN(saved.amountCents)}`);
    setAmount('');
    setNote('');
    reset();
    onSaved();
    amountRef.current?.focus();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5" aria-label="Registrar gasto">
          <AmountInput
            id="qe-amount"
            ref={amountRef}
            large
            value={amount}
            onChange={setAmount}
            onBlur={() => touch('qe-amount')}
            error={error('qe-amount')}
          />

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">
              Categoría
            </span>
            <ChipGroup
              label="Categorías más usadas"
              options={topCategories(selectableCategories).map((o) => ({ value: o.id, label: o.label, color: o.color }))}
              value={categoryId}
              onChange={setCategoryId}
            />
            <SelectField
              id="qe-category"
              label="Otra categoría"
              value={categoryId ?? ''}
              onChange={(event) => setCategoryId(event.target.value ? Number(event.target.value) : null)}
              onBlur={() => touch('qe-category')}
              error={error('qe-category')}
            >
              <option value="">Selecciona…</option>
              {selectableCategories.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold font-display uppercase tracking-wide text-text-muted">Método de pago</span>
            <ChipGroup
              label="Método de pago"
              options={methods.map((m) => ({ value: m.key, label: m.label }))}
              value={method}
              onChange={chooseMethod}
            />
          </div>

          {hasOpenCash && <PaidFromRegisterToggle checked={paidFromRegister} onChange={chooseRegisterCash} />}

          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <TextField
              id="qe-date"
              label="Fecha"
              type="date"
              value={date}
              max={todayLocal()}
              onChange={(event) => setDate(event.target.value)}
              onBlur={() => touch('qe-date')}
              error={error('qe-date')}
            />
            <TextField
              id="qe-note"
              label="Nota (opcional)"
              value={note}
              maxLength={NOTE_MAX}
              autoComplete="off"
              placeholder="Ej. 3 sacos de harina"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <Button type="submit" size="lg" variant="accent" loading={loading} className="w-full sm:w-auto sm:self-end">
            Guardar gasto
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
