import { useId, useState, type FormEvent } from 'react';
import { formatPEN } from '@sabor/shared';
import { useMutation } from '../../hooks/useMutation';
import { voidTableTab } from '../../lib/tablesApi';
import { Button } from '../ui/Button';
import { PosModal } from '../pos/PosModal';

const REASON_MAX = 200;

interface VoidTabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableId: number;
  tabId: number;
  tableName: string;
  totalCents: number;
  onVoided: () => void;
}

/** Anular la cuenta de una mesa (owner/admin): pide motivo y confirma; no genera venta ni ingreso. */
export function VoidTabDialog({ open, onOpenChange, tableId, tabId, tableName, totalCents, onVoided }: VoidTabDialogProps) {
  const fieldId = useId();
  const [reason, setReason] = useState('');
  const { mutate, loading } = useMutation(voidTableTab);
  const trimmed = reason.trim();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed || loading) return;
    const result = await mutate(tableId, tabId, trimmed);
    if (result) onVoided();
  }

  return (
    <PosModal
      open={open}
      onOpenChange={(next) => !loading && onOpenChange(next)}
      title={`¿Anular la cuenta de ${tableName}?`}
      description={`Se descartan ${formatPEN(totalCents)} sin cobrar y la mesa queda libre. No se puede deshacer.`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fieldId} className="font-display text-xs font-bold uppercase tracking-wide text-text-muted">
            Motivo (obligatorio)
          </label>
          <textarea
            id={fieldId}
            rows={3}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Por ejemplo: el cliente se retiró sin consumir"
            data-autofocus=""
            className="w-full resize-y rounded-xl border-2 border-border bg-surface px-3 py-2 text-base text-text outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" loading={loading} disabled={!trimmed}>
            Sí, anular cuenta
          </Button>
        </div>
      </form>
    </PosModal>
  );
}
