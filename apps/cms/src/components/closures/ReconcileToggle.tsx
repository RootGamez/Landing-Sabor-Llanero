interface ReconcileToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** "Cuadrar caja": opcional y desmarcado por defecto (D15). Casilla nativa: teclado y lector de pantalla gratis. */
export function ReconcileToggle({ checked, onChange }: ReconcileToggleProps) {
  return (
    <label
      htmlFor="closure-reconcile"
      className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border-2 border-border bg-surface px-3.5 py-2.5 has-[:checked]:border-forest has-[:checked]:bg-lime-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
    >
      <input
        id="closure-reconcile"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-forest"
      />
      <span className="flex flex-col text-sm font-semibold text-text">
        Cuadrar caja (contar efectivo)
        <span className="text-xs font-normal text-text-muted">
          Si no la marcas, la caja se cierra sin comparar el efectivo y el resumen dirá "Caja no cuadrada".
        </span>
      </span>
    </label>
  );
}
