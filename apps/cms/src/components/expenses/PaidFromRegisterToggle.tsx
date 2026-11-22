interface PaidFromRegisterToggleProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** "Pagado con efectivo de caja": el gasto descuenta del efectivo esperado de la caja abierta. */
export function PaidFromRegisterToggle({ id = 'paid-from-register', checked, onChange }: PaidFromRegisterToggleProps) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border-2 border-border bg-surface px-3.5 py-2.5 has-[:checked]:border-forest has-[:checked]:bg-lime-soft"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-forest"
      />
      <span className="flex flex-col text-sm font-semibold text-text">
        Pagado con efectivo de caja
        <span className="text-xs font-normal text-text-muted">Se descuenta del efectivo esperado al cerrar la caja.</span>
      </span>
    </label>
  );
}
