import { useRef, useState, type FormEvent } from 'react';
import { todayLocal, formatPEN, type ExpenseInput, type PaymentMethod } from '@sabor/shared';
import { useFieldErrors } from '../../hooks/useFieldErrors';
import { useMutation } from '../../hooks/useMutation';
import { createExpense } from '../../lib/expensesApi';
import { toastSuccess } from '../../store/toastStore';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/card';
import { TextField } from '../ui/FormField';
import { DatePicker } from '../ui/DatePicker';
import { AmountInput } from './AmountInput';
import { CategoryField } from './CategoryField';
import { ChipGroup } from './ChipGroup';
import { ensureCategoryId, type CategorySelection } from './categorySelection';
import { amountErrorMessage, parseAmountToCents, type CategoryOption } from './expenseUtils';
import { PaidFromRegisterToggle } from './PaidFromRegisterToggle';

const CASH_KEY = 'efectivo';
const DETAIL_MAX = 200;

interface ExpenseQuickFormProps {
  categories: readonly CategoryOption[];
  methods: readonly PaymentMethod[];
  hasOpenCash: boolean;
  onSaved: () => void;
}

type ExpenseDraft = Omit<ExpenseInput, 'categoryId'>;

/**
 * Registro rápido (objetivo < 15 s): monto → tipo (chips o escribiendo) → Enter.
 * Tras guardar se conserva el tipo, la fecha y el método y el foco vuelve al
 * monto. Si el tipo es nuevo, la categoría se crea justo antes del gasto.
 */
export function ExpenseQuickForm({ categories, methods, hasOpenCash, onSaved }: ExpenseQuickFormProps) {
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<CategorySelection | null>(null);
  const [date, setDate] = useState(() => todayLocal());
  const [detail, setDetail] = useState('');
  const [method, setMethod] = useState(CASH_KEY);
  const [paidFromRegister, setPaidFromRegister] = useState(false);
  // Tipo recién creado: se muestra por su nombre hasta que llegue la lista de categorías actualizada.
  const [justCreated, setJustCreated] = useState<CategoryOption | null>(null);
  const { mutate: save, loading } = useMutation(async (selection: CategorySelection, draft: ExpenseDraft) =>
    createExpense({ ...draft, categoryId: await ensureCategoryId(selection, categories) }),
  );

  const amountCents = parseAmountToCents(amount);
  const { error, touch, validate, reset } = useFieldErrors({
    'qe-amount': amountErrorMessage(amount),
    'qe-category': category === null ? 'Elige un tipo de gasto o escribe uno nuevo' : null,
    'qe-date': date ? null : 'Elige la fecha del gasto',
  });

  const known = categories.filter((option) => option.isActive);
  const selectable = justCreated && !known.some((c) => c.id === justCreated.id) ? [...known, justCreated] : known;

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
    if (!validate() || amountCents === null || category === null) return;
    const saved = await save(category, {
      date,
      amountCents,
      description: detail.trim(),
      paymentMethod: method,
      paidFromRegister: hasOpenCash && paidFromRegister,
    });
    if (!saved) return;
    toastSuccess(`Gasto guardado: ${formatPEN(saved.amountCents)}`);
    if (category.kind === 'new') {
      const name = category.name.trim();
      setJustCreated({ id: saved.categoryId, name, label: name, color: null, isActive: true, expenseCount: 1 });
    }
    setCategory({ kind: 'existing', id: saved.categoryId });
    setAmount('');
    setDetail('');
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

          <CategoryField
            id="qe-category"
            categories={selectable}
            value={category}
            onChange={setCategory}
            onBlur={() => touch('qe-category')}
            error={error('qe-category')}
          />

          <TextField
            id="qe-detail"
            label="Detalle (opcional)"
            value={detail}
            maxLength={DETAIL_MAX}
            autoComplete="off"
            placeholder="Ej.: queso mozzarella 5 kg"
            onChange={(event) => setDetail(event.target.value)}
          />

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

          <div className="grid gap-4 sm:grid-cols-[12rem_1fr] sm:items-end">
            <DatePicker
              id="qe-date"
              label="Fecha"
              value={date}
              max={todayLocal()}
              onValueChange={setDate}
              error={error('qe-date')}
            />
            <Button type="submit" size="lg" variant="accent" loading={loading} className="w-full sm:w-auto sm:self-end sm:justify-self-end">
              Guardar gasto
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
