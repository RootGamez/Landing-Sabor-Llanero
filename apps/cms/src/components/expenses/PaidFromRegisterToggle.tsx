import { CheckboxField } from '../ui/Checkbox';

interface PaidFromRegisterToggleProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** "Pagado con efectivo de caja": el gasto descuenta del efectivo esperado de la caja abierta. */
export function PaidFromRegisterToggle({ id = 'paid-from-register', checked, onChange }: PaidFromRegisterToggleProps) {
  return (
    <CheckboxField
      id={id}
      variant="card"
      label="Pagado con efectivo de caja"
      description="Se descuenta del efectivo esperado al cerrar la caja."
      checked={checked}
      onCheckedChange={(value) => onChange(value === true)}
    />
  );
}
