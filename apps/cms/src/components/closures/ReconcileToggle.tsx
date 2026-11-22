import { CheckboxField } from '../ui/Checkbox';

interface ReconcileToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** "Cuadrar caja": opcional y desmarcado por defecto (D15). */
export function ReconcileToggle({ checked, onChange }: ReconcileToggleProps) {
  return (
    <CheckboxField
      id="closure-reconcile"
      variant="card"
      label="Cuadrar caja (contar efectivo)"
      description='Si no la marcas, la caja se cierra sin comparar el efectivo y el resumen dirá "Caja no cuadrada".'
      checked={checked}
      onCheckedChange={(value) => onChange(value === true)}
    />
  );
}
